# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

TailgatePro (a.k.a. "Digital Toolbox Safety Talks") digitizes OSHA-mandated construction safety meetings. It is a **mobile-first, offline-capable PWA**: subcontractor foremen run safety talks in the field (often disconnected), and general contractors audit compliance from a dashboard. See `docs/PRD.md` for the full product vision.

The project is early-stage scaffolding. Most server routes and many client folders described in the docs do not exist yet.

## Repository layout

This is a two-package repo, not a workspace:

- **Root** (`package.json`) — the Node/Express API server. Entry point `server.js`. Source lives in `server/`.
- **`client/`** (`client/package.json`) — the Vite + React 19 PWA front end. Source in `client/src/`.

Each package has its own `node_modules` and its own `.env`. Run `npm install` in both.

## Commands

### Running the app (from repo root)

- `npm run dev` — runs server + client together via `concurrently`.
- `npm run server` — server only (`nodemon server.js`), port `5000`.
- `npm run client` — client only (proxies to `npm run dev --prefix client`).
- `npm run start-prod` — builds the client, then starts the server, which serves `client/dist` statically and falls back to `index.html` for SPA routes.

### Client (from `client/`)

- `npm run dev` — Vite dev server on **`https://localhost:5173`**. It runs over HTTPS with a self-signed cert (`@vitejs/plugin-basic-ssl`) and binds all interfaces (`host: true`). Expect a browser cert warning.
- `npm run build` — `tsc -b && vite build` (type errors fail the build).
- `npm run lint` — ESLint (flat config, `client/eslint.config.js`).
- `npm run preview` — serve the production build locally.

### Tests

- Unit testing standard is **Vitest only — never Jest** (`.github/copilot-instructions.md`, `docs/unit-testing.md`).
- Run all: `npx vitest run` (from `client/`). Watch: `npx vitest`. Single file: `npx vitest path/to/file.test.tsx`. By name: `npx vitest -t "should validate password"`. Coverage: `npx vitest run --coverage`.
- Client Vitest config (in `client/vite.config.ts`) runs in **browser mode** (Playwright, Chromium, `headless: false`), expects specs under `client/tests/**/*.test.{ts,tsx}`, loads `client/setupTests.ts`, and enforces **90% coverage thresholds**. Those test dirs/files do not exist yet — create them when adding the first test.
- Server-side tests use Vitest too (confirmed with the maintainer as of the auth feature): a root `vitest.config.js` runs specs matching `server/**/*.test.js` (`npm run test:server`, or `npm test` from root, which runs both server and client suites). Root devDependencies still list `mocha`/`chai`/`sinon` — these are unused legacy leftovers, not the standard. Server test files must be plain CommonJS (`require`/`module.exports`, no `import` statements) — see the note at the top of `server/middlewares/requireAuth.test.js` for why: mixing `import` in a test file with a `require()`-based CJS module under test can produce two separate module instances, silently defeating any mock/spy on the CJS one.

## Architecture

### Server (layered, framework-agnostic core)

Per `docs/coding-style.md` and `docs/folder-structure.md`, keep strict separation:

- `server/routes/` — endpoints + middleware wiring only, no logic.
- `server/controllers/` — parse `req`, call a service, send the HTTP response, `next(error)` on failure.
- `server/services/` — pure business logic and all Supabase / Stripe / Cloudinary / email calls. **Never import Express types or touch `req`/`res` here.**
- `server/middlewares/` — validation (`express-validator`), auth, error handling.
- `server/utility/` — helpers.

`server.js` binds a global error-handling middleware last. Currently every route mount and the cron-job callbacks in `server.js` are commented out or reference not-yet-defined functions — wiring them up is expected work, not a bug to "fix" by deleting.

### Client

Folder conventions (`docs/folder-structure.md`) — most of these are planned, not present: `features/`, `services/` (API-call functions per domain, e.g. `apiAuth`), `pages/`, `partials/` (modal contents), `ui_comps/` (reusable primitives), `context/`, `hooks/`, `interfaces/`, `constants/`, `data/`, `utils/`, `styles/`.

`client/src/App.tsx` composes providers in this order: `AuthProvider` → styled-components `ThemeProvider` → `QueryClientProvider` → `GlobalStyles` → `BrowserRouter`. `main.tsx` currently renders without `StrictMode`.

- **Server state:** TanStack Query. Do not hand-roll loading/error flags with `useEffect` (`docs/coding-style.md`). The `QueryClient` is currently configured with `staleTime: 0, gcTime: 0`.
- **Forms:** React Hook Form + Zod (`zodResolver`), `mode: 'onTouched'`. Use native `register` for text/checkbox/textarea; `<Controller>` only for complex third-party inputs. Do **not** use `forwardRef` — take `ref` as a normal prop (React 19). See `docs/ui-inputs.md`.
- **Toasts:** `react-hot-toast` `<Toaster>` mounted in `App.tsx`.
- **PWA:** `vite-plugin-pwa` with `strategies: "injectManifest"` and a hand-written `client/src/service-worker.ts`.

### Auth (Supabase)

- One Supabase client only, created in `client/src/context/auth/auth-provider.ts`. Never call `createClient` or `supabase.auth.getUser()` elsewhere.
- Consume auth via the `useAuth()` hook (`client/src/context/auth/use-auth.ts`), which uses the React 19 `use()` API and throws if used outside `<AuthProvider>`.
- `AuthProvider` seeds state from `getSession()` and subscribes to `onAuthStateChange` (unsubscribes on unmount). It exposes `user`, `loading`, `loginWithGoogle` (Google OAuth), and `logout`.
- Protected routes should redirect unauthenticated users at the routing layer (not yet implemented).

### Environment config

Both sides centralize key selection in a `keysBasedOnEnv()` function that branches on environment:

- Client: `client/src/utils/EnvUtils.tsx` — branches on `import.meta.env.MODE`; reads `VITE_`-prefixed vars (`VITE_SUPABASE_URL` / `VITE_SUPABASE_URL_PROD`, etc.). `client/vite.config.ts` also copies `VITE_` vars onto `process.env.*` via `define`.
- Server: `server/utility/envUtils.js` — branches on `NODE_ENV`; reads `process.env.*` for Supabase, Stripe, Cloudinary, Mailgun. `server.js` loads `dotenv` only when `NODE_ENV !== "production"`.

Add new keys to both the prod and non-prod branches of the relevant function.

### Database (Supabase / PostgreSQL)

Schema is documented in `Supabase_Schema.md`; the runnable DDL is `Supabase_SQL.sql`. Core tables: `companies`, `users` (id references `auth.users`), `projects`, `project_subcontractors` (composite PK), `toolbox_talks` (content library, `trade_tag`-indexed), `meeting_logs`, `signatures`.

**Offline-sync rule:** every table's `id` is a `UUID` with no DB default. Primary keys must be **generated client-side** (`crypto.randomUUID()`) before writing to IndexedDB, so offline records don't collide on sync. `meeting_logs.synced_at` tracks sync state.

## Styling conventions

- **styled-components only** — no inline `style={{}}`, no plain CSS files (`docs/ui-styling.md`).
- **Never hardcode** colors/spacing/breakpoints — read from `props.theme`. `client/src/styles/theme.ts` maps every token to a CSS custom property defined in `client/src/index.css`. Color scales: `orange`, `navy`, `concrete`, `red`, `green`.
- Prefix styled elements `Styled*`; prefix style-only props with `$` (transient props). Keep styles beside the component (`.styles.ts`, or inline if < 30 lines). Max 3 levels of CSS nesting.
- **Mobile-first** (`docs/responsive.md`): base styles target mobile; scale up with `min-width` queries only. Interactive elements ≥ **48×48px** touch targets. Inputs use `font-size: 16px` to prevent iOS auto-zoom.
- **Field UX:** high contrast, large tap targets, minimal typing — users are on job sites wearing gloves in bright sun.

## Code style

- **Client:** functional components with arrow functions; props typed with `interface` (not `type`); PascalCase component files, camelCase hooks/utils; **named exports preferred over default**; derive values in render instead of storing derived state; exhaustive hook dependency arrays; no `console.log` left in code.
- **Server (documented target):** `async/await` only (no mixed `.then().catch()`); wrap callback APIs with `util.promisify`; let errors propagate to the global handler; structured JSON responses `{ success, data }` / `{ success, error }`; explicit HTTP status codes.
- **Error handling** (`docs/error-handling.md`): only handle known failures; never swallow errors in empty `catch`; extend a base `AppError` rather than throwing strings; preserve the original error in `cause`.
- Prefer minimal, surgical diffs. Do not reformat whole files or run Prettier/ESLint autoformat unless asked. Do not add major dependencies without approval.

## Working with `docs/`

`docs/` is the source of truth for conventions — **read the relevant file before changing code** (`.github/copilot-instructions.md`). Files: `PRD.md`, `folder-structure.md`, `coding-style.md`, `error-handling.md`, `unit-testing.md`, `ui-styling.md`, `responsive.md`, `ui-inputs.md`, `auth.md`. If code and docs disagree, flag it rather than silently picking one.
other docs files:

- `pricing-and-positioning-strategy_V2.md`

### Known code/doc mismatches (verify before relying on either)

- `docs/coding-style.md` says the server uses ES Modules (`import/export`); `server.js` and `server/utility/envUtils.js` are CommonJS (`require`/`exports`).
- Docs reference client primitives at `src/components/ui-comps/`; the actual path is `client/src/ui_comps/`.
- `docs/ui-styling.md` mentions `theme.spacing`, `theme.typography`, and named breakpoints (`mobile`/`tablet`/`desktop`); `theme.ts` currently defines `colors`, `shadows`, `borderRadius`, and numeric `breakpoints` keys (`xs`–`2xl`) only.
