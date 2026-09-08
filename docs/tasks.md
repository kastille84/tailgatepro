# TailgatePro — Build Checklist (post-Auth)

Living checklist for the work planned after the Auth feature. Ask "what's next?" against this file.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[-]` deferred/blocked

Full rationale and phase feasibility notes live in the plan at
`~/.claude/plans/we-have-the-auth-radiant-barto.md`.

---

## Phase 0 — Foundations  ·  status: in progress

- [x] 0a. Register the service worker via `virtual:pwa-register` in `client/src/main.tsx`
      (guarded to production so it is a no-op in dev and tests)
- [x] 0a. Add a `manifest` to the `VitePWA` config in `client/vite.config.ts`
- [x] 0a. Add `<meta name="theme-color">` + Apple web-app meta to `client/index.html`
      (the `<link rel="manifest">` is injected by `vite-plugin-pwa`)
- [x] 0a. Add `client/src/vite-env.d.ts` referencing `vite-plugin-pwa/client` for `registerSW` types
- [x] 0a. PWA icon set: `@vite-pwa/assets-generator` (dev dep) + `client/pwa-assets.config.ts`
      (`minimal-2023` preset) generates `pwa-64/192/512`, `maskable-icon-512x512`,
      `apple-touch-icon-180x180`, `favicon.ico` into `client/public/` from the 1024² master
      `client/public/logo.png`. Wired via `pwaAssets: { config: true }` in `client/vite.config.ts`
      (`includeHtmlHeadLinks`/`injectThemeColor` off — head `<link>`s are hand-written in
      `index.html`); the master is kept out of the SW precache via `injectManifest.globIgnores:
      ["logo.png"]`. Old Leaflyt `favicon.svg` deleted. Generated icons are committed under
      `client/public/`.
- [x] 0a. Build verified: `dist/manifest.webmanifest` lists the 4 PNG icons (64/192/512 +
      maskable), `dist/index.html` has one each of icon / apple-touch-icon / theme-color / manifest
      link (no duplicates), `dist/service-worker.js` precache is 13 entries / ~1.2 MB
- [ ] 0a. Manual smoke on a device: `npm run build && npm run preview` (HTTPS via basic-ssl),
      install the PWA, reload offline, confirm the shell renders. LAN device: `preview -- --host`.
- [ ] 0a. Housekeeping: a stray `client/public/pwa_icon.jpg` (563 KB) was added alongside the
      master — remove it if it is not needed (it is copied into `dist/` but not used)
- [x] 0b. `ui_comps/modal/` — hand-rolled portal dialog (Esc + overlay close, focus trap,
      focus restore, `role="dialog"`/`aria-modal`) + test.
      Note: built with `react-dom` `createPortal` instead of the untyped `react-modal` dep.
- [x] 0b. `ui_comps/spinner/` + test
- [x] 0b. `ui_comps/checkbox/` + test
- [x] 0b. `ui_comps/radio/` (`RadioGroup` + `Radio`) + test
- [x] 0b. `ui_comps/select/` + test
- [x] 0c. Document the data-access model in `docs/data-access.md` (server-brokered, RLS deny-all)

## Phase 1 — Projects module  ·  status: not started

- [ ] Pre-req: confirm `Supabase_SQL.sql` (projects, project_subcontractors, enums) applied
- [ ] 1a. `usersService.getUserContext(id)` in `server/services/users.js`
- [ ] 1a. `server/middlewares/loadUserContext.js` (+ `.test.js`)
- [ ] 1b. `server/services/projects.js` — `listForCompany` / `create` / `update` (+ `.test.js`)
- [ ] 1b. `server/controllers/projects.js` (+ `.test.js`)
- [ ] 1b. `server/routes/projects.js` — GET / POST / PATCH with express-validator chains
- [ ] 1b. Mount `/api/projects` in `server.js`
- [ ] 1c. `client/src/interfaces/project.ts`
- [ ] 1c. `client/src/services/apiProjects.ts` (Bearer auth, client-generated UUID on create) + test
- [ ] 1c. `client/src/hooks/useProjects.ts` (first `useQuery`) + test
- [ ] 1c. `client/src/hooks/useCreateProject.ts` / `useUpdateProject.ts` (+ invalidate) + tests
- [ ] 1c. `client/src/features/projects/` — `ProjectList`, `ProjectForm` (in Modal) + tests
- [ ] 1c. `client/src/pages/Projects/` + `/projects` route under `RequireAuth` + Nav/Dashboard link
- [ ] Verify: create/edit a project end-to-end; row lands in Supabase with client UUID
- [ ] Confirm client coverage still ≥ 90%; `npm run build` + `npm run lint` clean

## Phase 2 — Content Library (toolbox_talks)   ·   epic, expand when reached

- [ ] Seed script: ~30 public-domain OSHA talks with `trade_tag`
- [ ] Server: list / filter-by-trade / search / get
- [ ] Client: browse + trade filter + search + talk detail
- [ ] Custom talks (company-scoped create)
- [ ] Schema: add `user_favorites` table; favorites toggle + filter

## Phase 3 — Offline foundation   ·   epic, design spike first

- [ ] Design doc: IndexedDB schema + sync state machine (reviewed)
- [ ] Add Dexie; tables for meeting_logs, signatures, cached projects/talks
- [ ] Outbound sync queue: enqueue → flush on `online` → set `synced_at`
- [ ] Online/offline indicator; last-write-wins
- [ ] Retro-fit Projects create/edit through the queue

## Phase 4 — Run-a-Talk flow + signatures   ·   epic

- [ ] Supabase Storage buckets (signatures, crew photos) + access rules
- [ ] Meeting wizard: project → talk → present → (TTS + quiz) → signatures → photo → save
- [ ] Canvas finger-signing component
- [ ] Schema: quiz question storage (table or JSONB on toolbox_talks)

## Phase 5 — PDF generation + GC delivery   ·   epic

- [ ] Server PDF service (PDFKit) — generate on sync, store `final_pdf_url`
- [ ] Email PDF to GC (dev transport until paid Mailgun)

## Phase 6 — GC dashboard   ·   epic, blocked by invite/join-company

- [ ] GC views: projects, incoming meeting-log PDFs, per-sub compliance status

## Cross-cutting — Invite / join-company flow   ·   epic, prerequisite for multi-user + Phase 6

- [ ] Admin invites by email; invitee joins an existing `companies` row
- [ ] Real use of `admin` / `safety_manager` roles
- [ ] GC links a sub company to a project (`project_subcontractors`)

## Deferred

- [-] Stripe billing (needs multi-user/site concepts; reconcile `companies.tier` enum first)
- [-] Procore integration
