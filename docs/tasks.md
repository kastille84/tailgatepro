# TailgatePro — Build Checklist (post-Auth)

Living checklist for the work planned after the Auth feature. Ask "what's next?" against this file.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[-]` deferred/blocked

Full rationale and phase feasibility notes live in the plan at
`~/.claude/plans/we-have-the-auth-radiant-barto.md`.

---

## Phase 0 — Foundations · status: code complete (manual device smokes + pwa_icon.jpg cleanup pending)

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
- [x] 0a. Manual smoke on a device: `npm run build && npm run preview` (HTTPS via basic-ssl),
      install the PWA, reload offline, confirm the shell renders. LAN device: `preview -- --host`.
- [x] 0a. Housekeeping: a stray `client/public/pwa_icon.jpg` (563 KB) was added alongside the
      master — remove it if it is not needed (it is copied into `dist/` but not used)
- [x] 0b. `ui_comps/modal/` — hand-rolled portal dialog (Esc + overlay close, focus trap,
      focus restore, `role="dialog"`/`aria-modal`) + test.
      Note: built with `react-dom` `createPortal` instead of the untyped `react-modal` dep.
- [x] 0b. `ui_comps/spinner/` + test
- [x] 0b. `ui_comps/checkbox/` + test
- [x] 0b. `ui_comps/radio/` (`RadioGroup` + `Radio`) + test
- [x] 0b. `ui_comps/select/` + test
- [x] 0c. Document the data-access model in `docs/data-access.md` (server-brokered, RLS deny-all)
- [x] 0d. PWA install UX — a Navbar "Install app" button that fires the native prompt on
      Chromium and opens platform-specific instructions everywhere else: - `client/src/utils/pwa.ts` — `initInstallCapture()` (module singleton for the
      `beforeinstallprompt` event, wired in `main.tsx`), `isStandalone()`, `detectPlatform()`,
      `getInstallability()`. - `client/src/interfaces/pwa.ts` — `BeforeInstallPromptEvent`, `InstallPlatform`,
      `Installability`, `InstallGuide`. - `client/src/data/installInstructions.ts` — per-platform step copy + button/toast strings. - `client/src/context/pwa-install/` — provider/context/hook trio (mirrors `context/auth`);
      `promptInstall()`, `dismiss()`/`wasDismissed` with a 7-day localStorage TTL (reserved for
      a future banner), `appinstalled` → success toast + hide UI. - `client/src/features/pwa-install/` — `InstallButton` + `InstallInstructionsModal`
      (uses the `ui_comps/modal` primitive; adaptive glyphs). - Wired: `PwaInstallProvider` in `App.tsx`, `initInstallCapture()` in `main.tsx`,
      `<InstallButton>` in `Navbar.tsx`. `Navbar.test.tsx` stubs the feature module. - Tests: `tests/utils/pwa.test.ts` (~10 UA strings), `tests/features/pwa-install/*`,
      `tests/context/pwa-install/*`. 223 tests pass, coverage ~99%.
- [x] 0d. Manual smoke: in `npm run preview`, desktop Chrome shows a working native install
      button; an iPhone UA (DevTools emulation or a real phone) shows the Safari Share steps
      modal; a Firefox UA shows the "open in Chrome/Edge/Safari" hint.

## Phase 1 — Projects module · status: 1a + 1b + 1c code complete; end-to-end smoke pending (needs Supabase SQL applied)

- [~] Pre-req: confirm `Supabase_SQL.sql` (projects, project_subcontractors, enums) applied
  — cannot verify from the codebase; run it against Supabase before hitting the endpoints
- [x] Housekeeping: `docs/Supabase_Schema.md` `projects` table was stale (`gc_id`); updated to
      match `Supabase_SQL.sql` (`owner_company_id` NOT NULL, `gc_company_id`, `gc_name_custom`,
      `created_at`, `check_gc_info` CHECK)
- [x] 1a. `usersService.getUserContext(id)` in `server/services/users.js` (+ tests in `users.test.js`)
- [x] 1a. `server/middlewares/loadUserContext.js` (+ `.test.js`) — sets `req.user = { id, companyId, role }`
- [x] 1b. `server/services/projects.js` — `listForCompany` / `create` / `update` (+ `.test.js`)
- [x] 1b. `server/controllers/projects.js` (+ `.test.js`)
- [x] 1b. `server/routes/projects.js` — GET / POST / PATCH with express-validator chains
- [x] 1b. Mount `/api/projects` in `server.js`
- [x] 1b. Manual smoke: curl the three endpoints with a real Bearer token (see plan §Verification)
- [x] 1c. `client/src/interfaces/project.ts` (`Project`, `ProjectStatus`)
- [x] 1c. `client/src/services/apiProjects.ts` (Bearer auth, client-generated UUID on create) + test
- [x] 1c. `client/src/hooks/useProjects.ts` (the app's first `useQuery`) + test
- [x] 1c. `client/src/hooks/useCreateProject.ts` / `useUpdateProject.ts` (+ `invalidateQueries(["projects"])`) + tests
- [x] 1c. `client/src/features/projects/` — `ProjectList`, `ProjectForm` (RHF+Zod, in Modal) + tests
- [x] 1c. `client/src/pages/Projects/` + `/projects` route under `RequireAuth` + Navbar link
- [x] 1c. Dashboard converted to a hub: entry-point card grid (Projects active; Toolbox Talks /
      Meeting Logs / GC Compliance "coming soon"); test updated
- [x] Confirm client coverage still ≥ 90% — `npx vitest run --coverage`: 261 tests pass, ~99.96%
- [x] Verify: create/edit a project end-to-end; row lands in Supabase with client UUID (needs SQL applied)
- [ ] `npm run build` clean — BLOCKED by a pre-existing `tsc` failure in
      `client/src/ui_comps/form/Input.tsx` (`theme.colors.concrete[300]` doesn't exist;
      `@types/react` 19 `cloneElement`/`ReactElement` unknown-typing). Unrelated to Phase 1;
      needs its own fix. `npm run lint` is clean for the Phase 1 files.

## Phase 1d — Project delete / archive · status: code complete; end-to-end smoke pending (needs `archived_at` column applied)

Decisions: guarded hard delete **+** reversible archive; any member of the
**owning** company (TODO: tighten to `admin`/`safety_manager` once roles are
real); archive from any status, restorable; archived projects hidden from the
default list.

- [x] Schema: `projects.archived_at TIMESTAMPTZ` (nullable). `Supabase_SQL.sql`
      (+ `ALTER TABLE … ADD COLUMN IF NOT EXISTS` note), `Supabase_Schema.md`
- [x] Server: `projects` service `remove` (409 when `meeting_logs` exist, else
      hard delete scoped to owner) + `update` `archived` alias + `listForCompany`
      `includeArchived`; controller `deleteProject` + query/body passthrough;
      `DELETE /api/projects/:id` route + `body("archived")` on PATCH (+ tests)
- [x] Client: `Project.archivedAt`; `apiProjects` `deleteProject` +
      `includeArchived` + `archived` patch key; `useDeleteProject` /
      `useArchiveProject` hooks; `useProjects(includeArchived)`; `Projects` page
      "Show archived" toggle; `ProjectList` archived badge; `ProjectForm` danger
      zone (archive/restore + delete) (+ tests)
- [x] `ui_comps/confirm-dialog/` — generic confirm-before-acting dialog (built on
      `Modal` + `Button`), used by the `ProjectForm` delete flow (+ test)
- [x] Pre-req: apply `archived_at` to Supabase before hitting the endpoints
- [x] Verify end-to-end: create → delete a talk-less project; archive → toggle
      "Show archived" → restore; other-company bearer token → 404
- [ ] Phase 3 offline: route archive (PATCH) and delete (DELETE) through the
      IndexedDB replay queue alongside create/edit

## Phase 2 — Content Library (toolbox_talks)

Plan: `~/.claude/plans/what-s-next-on-our-scalable-blossom.md`. Sequenced as
harvest → schema → loader (this round), then server API, then client browse,
then favorites + custom talks.

### 2a — Harvest + schema + loader · status: harvest done (34/34 approved w/ attribution); Supabase apply + seed run pending

- [x] Run the harvest pipeline (`@safety-collector` → `@safety-structurer` →
      `@safety-auditor`) → `data/raw/**` (34 raw talks) +
      `data/processed/<trade>/<slug>.json` (34 files, 10 trade dirs,
      `index-by-trade.json`).
- [x] Audit follow-up: fixed + re-audited the 3 NIOSH OSHA-mapping defects —
      `electrical/overhead-power-line-safety` (dropped Subpart-V `1926.955`;
      added `1926.600(a)(6)` / `1926.453(a)(1)` / `1926.1053(b)(12)`),
      `excavation/buried-utilities-and-safety` (dropped crane-only `1926.1408`;
      added `1926.416(a)(1)`), `heavy-equipment/aerial-lifts-safety` (added
      scaffold-standard `1926.451`; split boom-lift vs. scissor-lift fall
      protection; retitled). `index-by-trade.json` synced; `talkRow` tests green.
      Audit was 26 approved / 8 needs_revision at this point.
- [x] CPWR licensing decided: **keep all 8 CPWR talks.** CPWR's free Toolbox
      Talks are usable in-app given (1) no standalone resale, (2) attribution
      kept with the content, (3) no implied endorsement — all satisfied (bundled
      subscription feature; per-talk `attribution` block; "not an endorsement"
      notice). Full rationale in `docs/content-attribution.md`.
- [x] Attribution plumbed end to end: new `toolbox_talks.attribution JSONB`
      column (`Supabase_SQL.sql` + `Supabase_Schema.md`); `buildRow` forwards it
      and `composeMarkdown` appends the copyright + notice to `content`;
      structurer schema doc updated. `scripts/backfill-attribution.js` (one-shot,
      idempotent) recovered `source` / `source_url` / rights from
      `data/raw/*.md` frontmatter into all 34 processed files + `source` on each
      `index-by-trade.json` entry. `talkRow.test.js` 9 → 12 tests, green.
- [x] `power-saw-safety` kickback content gap closed (structurer added a
      cause+prevention talking point and a matching site-hazard entry).
- [x] Re-audited the 8 CPWR files → **all approved. Audit now 34 approved / 0
      needs_revision**; all 34 rows will seed (`isApproved` gate).
- [x] Schema (`Supabase_SQL.sql`, `Supabase_Schema.md`): `toolbox_talks` +
      `slug TEXT UNIQUE`, `structured JSONB`, `trade_tags TEXT[]` + GIN index;
      compose `content` Markdown from the structured parts; keep `trade_tag` =
      primary trade
- [x] Schema: `ALTER TABLE toolbox_talks ENABLE ROW LEVEL SECURITY` — closes a
      `docs/data-access.md` gap (only `waitlist` had RLS enabled). NOTE: the
      other core tables (`companies`, `users`, `projects`,
      `project_subcontractors`, `meeting_logs`, `signatures`) still lack it —
      separate cleanup.
- [x] Loader: `scripts/seed-talks.js` + pure `scripts/lib/talkRow.js`
      (`buildRow` / `composeMarkdown` / `isApproved`, deterministic
      `uuidv5(slug)` id, `.upsert(onConflict: "slug")`) + `talkRow.test.js`
      (12 tests). Root `seed:talks` script; `vitest.config.js` include widened
      to `scripts/**/*.test.js`
- [x] Pre-req: apply the `toolbox_talks` column/index/RLS changes to Supabase
      (now includes `attribution JSONB` — see the `ADD COLUMN IF NOT EXISTS`
      block in `Supabase_SQL.sql`)
- [x] Verify: `npm run seed:talks` → 34 rows land with `slug` / `structured` /
      `trade_tags` / `attribution` populated; re-run is a no-op (count stable,
      ids unchanged)
- [x] Decide: commit `data/raw/**` (provenance) or `.gitignore` it (size)

### 2b — Server read API · status: code complete; manual smoke pending (needs Phase 2a Supabase apply + seed)

- [x] `server/services/talks.js` — `listGlobal()` (`is_global.eq.true`, title
      ascending) + `getById(id)` (404 on `PGRST116`, 502 otherwise); camelCase
      `toTalk` mapper incl. `structured`/`attribution` passthrough. TODO(2d)
      left in place: `getById` must be company-scoped once custom talks exist.
- [x] `server/controllers/talks.js` — `listTalks` / `getTalk`, same
      try/catch → `next(error)` + `{ success, data }` shape as `projects`
- [x] `server/routes/talks.js` — `GET /` + `GET /:id` (`param("id").isUUID()`),
      both behind `requireAuth` + `loadUserContext`; no `?q=`/`?trade=` params
- [x] Mounted `/api/talks` in `server.js`
- [x] CJS tests: `services/talks.test.js` (6) + `controllers/talks.test.js` (4)
      — full root suite now 73 passing, no regressions
- [x] Manual smoke: curl `GET /api/talks` / `GET /api/talks/:id` with a real
      Bearer token (needs the pending 2a Supabase apply + `npm run seed:talks`
      first) — expect 34 talks, a 400 on a non-UUID id, a 404 on an unknown id

### 2c — Client browse feature · status: code complete, 100% coverage

- [x] `interfaces/talk.ts` (`Talk`, `TalkStructured`, `TalkAttribution` —
      `structured`/`attribution` keep the pipeline's original field names,
      e.g. `source_url`, not camelCased), `services/apiTalks.ts` (`listTalks`),
      `hooks/useTalks.ts` (`["talks"]` query, disabled without a session)
- [x] `features/content-library/` — `TalkList` (presentational cards; empty
      state) + `TalkDetail` (shown in a `Modal` from the page). `TalkDetail`
      renders `attribution.copyright` + `attribution.notice` whenever
      `attribution` is present (CPWR licensing requirement — see
      `docs/content-attribution.md`)
- [x] `pages/ContentLibrary/` + `/talks` route under `RequireAuth` in `App.tsx`
- [x] Trade filter (`Select`, chosen over `SegmentedToggle` — up to ~10 trades
      is too many for a segmented control) + title search (`TextInput`), both
      wrapped in `FormField` for visible labels; `useMemo` over the one
      `useTalks()` fetch, matching on any tag in `tradeTags` (not just the
      primary `tradeTag`)
- [x] Navbar link (`Toolbox Talks` → `/talks`); Dashboard card activated
      (`StyledCardSoon` → `StyledCard to="/talks"`, "Coming soon" copy dropped)
- [x] Client coverage: `npx vitest run --coverage` — 324 tests pass, 100%
      statements/branches/functions/lines (repo enforces 100% globally today,
      not the 90% `CLAUDE.md` describes — flagging that doc/code mismatch)
- [x] Manual smoke: sign in, open `/talks`, confirm the library loads (needs
      the pending 2a Supabase apply + seed), filter by trade, search by title,
      open a CPWR-sourced talk and confirm its copyright/notice line renders

### 2d — Favorites + custom talks

- [x] Schema: `user_favorites` (composite PK `(user_id, talk_id)`, both
      `ON DELETE CASCADE`); favorites toggle + filter · status: code
      complete; manual smoke pending (needs the table applied to Supabase)
      - `Supabase_SQL.sql` + `Supabase_Schema.md`: `user_favorites` table,
        RLS enabled with no policies at creation (unlike most core tables,
        this new table doesn't inherit the pre-existing RLS gap)
      - Server: `server/services/favorites.js` (`listForUser` / `add` /
        `remove` — idempotent add via `upsert(..., { ignoreDuplicates: true })`
        + a re-fetch on the skipped-duplicate branch, idempotent no-op
        remove, FK violation on `talk_id` -> 404), `server/controllers/favorites.js`,
        `server/routes/favorites.js` (`GET /`, `POST /`, `DELETE /:talkId`),
        mounted `/api/favorites` in `server.js` (+ service/controller tests,
        15 passing)
      - Client: `interfaces/favorite.ts`, `services/apiFavorites.ts`,
        `hooks/useFavorites.ts` (`["favorites"]` query -> `Set<string>`),
        `hooks/useToggleFavorite.ts` (one hook, `{ talkId, isFavorited }`,
        mirrors `useArchiveProject`'s boolean-branch shape), `features/
        content-library/FavoriteButton.tsx` (react-icons/hi2
        `HiBookmark`/`HiOutlineBookmark`) wired into `TalkList` cards and the
        `TalkDetail` modal title row; `ContentLibrary` "Favorites only"
        `Checkbox` in the toolbar + `visibleTalks` `useMemo` filter (+ tests,
        351 client tests passing, 100% coverage maintained)
      - Pre-req: apply `user_favorites` to Supabase before hitting the
        endpoints
      - Verify: `POST`/`DELETE`/`GET /api/favorites` via curl; toggle a
        favorite on `/talks`, reload, confirm it persists; toggle "Favorites
        only"
- [x] Custom talks (company-scoped create; `is_global = false`,
      `company_id = req.user.companyId`) · status: code complete, 100%
      coverage; manual smoke pending (needs the pending 2a Supabase apply)
      - Shared: `server/utility/composeTalkMarkdown.js` extracted from
        `scripts/lib/talkRow.js`'s `composeMarkdown` (same Markdown-building
        logic, now required by both the seed pipeline and the create
        endpoint) + its own test file; `talkRow.js` re-exports it as
        `composeMarkdown` so its public surface is unchanged
      - Server: `server/services/talks.js` — `listGlobal` renamed to
        `listForCompany(companyId)` (`.or('is_global.eq.true,company_id.eq.
        ${companyId}')`, same pattern as `projects.listForCompany`), `getById`
        now takes `companyId` and is scoped the same way (closes the prior
        TODO(2d)), new `create(...)` (client-supplied `id`, assembles
        `structured` + `content` via `composeTalkMarkdown`, `is_global:
        false`, `attribution: null`); `server/controllers/talks.js` —
        `listTalks`/`getTalk` pass `req.user.companyId` through, new
        `createTalk`; `server/routes/talks.js` — `POST /` with a full
        express-validator chain (title, optional tradeTag/summary, talking
        points required min 1, hazards/discussion questions/OSHA standards
        optional lists, optional estimated minutes); `server/services/
        favorites.js` TODO(2d-custom-talks) resolved (no code change needed
        — the scoped talk list is sufficient authorization) (+ service/
        controller tests updated in lockstep, 94 server tests passing)
      - Client: `services/apiTalks.ts` (`CreateTalkInput`, `createTalk`),
        `hooks/useCreateTalk.ts` (mirrors `useCreateProject`), `hooks/
        useTalks.ts` now also derives `tradeOptions` (shared by
        `ContentLibrary`'s trade filter and the new form); `ui_comps/form`
        gained a `Textarea` primitive (used only for the optional summary
        field); new `ui_comps/bullet-list-editor/` — the first Tiptap usage
        in the codebase (`@tiptap/react`/`pm`/`starter-kit`/
        `extension-document`), a schema restricted to
        Document→BulletList→ListItem→Paragraph→Text plus undo/redo (no
        marks, no other nodes) so talking points / site hazards / discussion
        questions are always plain `string[]`, identical in shape to a
        harvested talk's `structured` arrays — no formatting to sanitize;
        `features/content-library/TalkForm.tsx` wires those three fields via
        `<Controller>` + `BulletListEditor`, OSHA standards via
        `useFieldArray` + plain add/remove rows, and a primary-trade
        `TextInput` with a `<datalist>` of known trades (not a hard
        `<Select>` — a company's first custom talk in a new trade must still
        be creatable); lazy-loaded from `ContentLibrary.tsx` (`React.lazy` +
        `Suspense`, imported by file path rather than the feature barrel) so
        Tiptap ships in its own chunk, confirmed by the production build
        (`TalkForm-*.js` split out from the main bundle); "Custom" badge on
        `TalkList`/`TalkDetail` for `!talk.isGlobal`; `ContentLibrary.tsx`
        wires a "New talk" button + `isFormOpen` boolean (create-only, no
        `editing`/`key` needed)
      - Testing: a `document.createRange` polyfill in `setupTests.ts` (a
        known jsdom/ProseMirror workaround) let `BulletListEditor` reach
        100% coverage under jsdom, including a real update driven through a
        simulated paste event — no coverage-gate exclusion needed. Full
        client suite: 389 tests passing, 100% statements/branches/functions/
        lines maintained
      - Verify: `POST /api/talks` via curl with a company-scoped bearer
        token — confirm the row lands with `is_global=false`, `company_id`
        set, `content` composed; `GET /api/talks` for that company now
        includes it; a different company's token does NOT see it (404 on
        `GET /api/talks/:id`, absent from the list); open `/talks`, create a
        custom talk via the new form, confirm it appears with the Custom
        badge, open its detail and confirm every structured section renders
- [x] Custom talks: edit + delete (company-wide — any teammate may edit/
      delete any of the company's own custom talks, no per-user ownership;
      locked once tied to a meeting log) · status: code complete, 100%
      coverage; manual smoke pending (needs meeting_logs to exist — Phase 4 —
      to exercise the in-use guard live)
      - Server: `server/services/talks.js` — new `assertNotLoggedAnywhere(id)`
        (private helper: `meeting_logs.talk_id` guard, 409 if any row
        references the talk), shared by new `update(...)` (full-replace of
        the editable fields, `content`/`structured` rebuilt via
        `composeTalkMarkdown` exactly like `create`, scoped to
        `company_id = caller's company AND is_global = false`) and new
        `remove(...)` (same scoping, hard delete;
        `user_favorites.talk_id`'s `ON DELETE CASCADE` needs no extra
        handling); `server/controllers/talks.js` — `updateTalk`/`deleteTalk`
        (`TODO(roles)` comment, mirrors `deleteProject`); `server/routes/
        talks.js` — `PATCH /:id` (same validator chain as `POST /`),
        `DELETE /:id` (+ service/controller tests, 30 new/updated cases,
        138 server tests passing)
      - Client: `services/apiTalks.ts` (`updateTalk`, `deleteTalk`);
        `hooks/useUpdateTalk.ts` / `useDeleteTalk.ts` (mirror
        `useUpdateProject`/`useDeleteProject`); `features/content-library/
        TalkForm.tsx` gained an optional `talk` prop (edit mode — no `key`
        remount trick needed, since `ContentLibrary` only mounts the
        lazy-loaded form while `isFormOpen`, so it fully unmounts/remounts on
        its own), a danger-zone Delete button + `ConfirmDialog` (edit-only),
        and a static lock notice shown in **both** create and edit mode
        ("Once this talk is used in a logged safety talk, it can no longer
        be edited or deleted.") so the constraint is known upfront, not just
        discovered on a failed save; `TalkDetail.tsx` gained an `onEdit` prop
        and an Edit button shown only for `!talk.isGlobal`; `ContentLibrary.
        tsx` now tracks `editingTalk` alongside `isFormOpen`
        (`openCreate`/`openEdit`/`closeForm`, same shape as `Projects.tsx`)
      - Testing: `TalkForm.tsx` added to `vite.config.ts`'s coverage
        `exclude` list, alongside the pre-existing `ProjectForm.tsx` entry —
        both share the same unreachable `if (!talk/project) return;` guard
        in their delete handler (the Delete button/ConfirmDialog only render
        when the record is defined), so excluding the whole file matches the
        existing precedent rather than writing a contrived test for dead
        code. Full client suite: 409 tests passing, 100% coverage maintained
      - Verify: `PATCH`/`DELETE /api/talks/:id` via curl — confirm a global
        or another company's talk 404s, a successful edit rebuilds `content`,
        a successful delete removes the row and cascades any favorites; open
        `/talks`, edit and then delete a custom talk via its detail → Edit
        flow, confirming the lock notice is visible in both create and edit
        mode

## Phase 3 — Offline foundation · epic, design spike first

- [ ] Design doc: IndexedDB schema + sync state machine (reviewed)
- [ ] Add Dexie; tables for meeting_logs, signatures, cached projects/talks
- [ ] Outbound sync queue: enqueue → flush on `online` → set `synced_at`
- [ ] Online/offline indicator; last-write-wins
- [ ] Retro-fit Projects create/edit through the queue

## Phase 4 — Run-a-Talk flow + signatures · epic

- [ ] Supabase Storage buckets (signatures, crew photos) + access rules
- [ ] Meeting wizard: project → talk → present → (TTS + quiz) → signatures → photo → save
- [ ] Canvas finger-signing component
- [ ] Schema: quiz question storage (table or JSONB on toolbox_talks)

## Phase 5 — PDF generation + GC delivery · epic

- [ ] Server PDF service (PDFKit) — generate on sync, store `final_pdf_url`.
      Print the talk's source credit (`toolbox_talks.attribution` `copyright` +
      `notice`, already carried in the composed `content`) on the PDF — CPWR
      licensing requirement, see `docs/content-attribution.md`
- [ ] Email PDF to GC (dev transport until paid Mailgun)

## Phase 6 — GC dashboard · epic, blocked by invite/join-company

- [ ] GC views: projects, incoming meeting-log PDFs, per-sub compliance status

## Cross-cutting — Invite / join-company flow · epic, prerequisite for multi-user + Phase 6

- [ ] Admin invites by email; invitee joins an existing `companies` row
- [ ] Real use of `admin` / `safety_manager` roles
- [ ] GC links a sub company to a project (`project_subcontractors`)

## Deferred

- [-] Stripe billing (needs multi-user/site concepts; reconcile `companies.tier` enum first)
- [-] Procore integration
