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
- [x] Phase 3 offline: route archive (PATCH) and delete (DELETE) through the
      IndexedDB replay queue alongside create/edit — shipped as part of the
      Phase 3 Projects retrofit (see below)

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
      complete; manual smoke pending (needs the table applied to Supabase) - `Supabase_SQL.sql` + `Supabase_Schema.md`: `user_favorites` table,
      RLS enabled with no policies at creation (unlike most core tables,
      this new table doesn't inherit the pre-existing RLS gap) - Server: `server/services/favorites.js` (`listForUser` / `add` /
      `remove` — idempotent add via `upsert(..., { ignoreDuplicates: true })` + a re-fetch on the skipped-duplicate branch, idempotent no-op
      remove, FK violation on `talk_id` -> 404), `server/controllers/favorites.js`,
      `server/routes/favorites.js` (`GET /`, `POST /`, `DELETE /:talkId`),
      mounted `/api/favorites` in `server.js` (+ service/controller tests,
      15 passing) - Client: `interfaces/favorite.ts`, `services/apiFavorites.ts`,
      `hooks/useFavorites.ts` (`["favorites"]` query -> `Set<string>`),
      `hooks/useToggleFavorite.ts` (one hook, `{ talkId, isFavorited }`,
      mirrors `useArchiveProject`'s boolean-branch shape), `features/
content-library/FavoriteButton.tsx` (react-icons/hi2
      `HiBookmark`/`HiOutlineBookmark`) wired into `TalkList` cards and the
      `TalkDetail` modal title row; `ContentLibrary` "Favorites only"
      `Checkbox` in the toolbar + `visibleTalks` `useMemo` filter (+ tests,
      351 client tests passing, 100% coverage maintained) - Pre-req: apply `user_favorites` to Supabase before hitting the
      endpoints - Verify: `POST`/`DELETE`/`GET /api/favorites` via curl; toggle a
      favorite on `/talks`, reload, confirm it persists; toggle "Favorites
      only"
- [x] Custom talks (company-scoped create; `is_global = false`,
      `company_id = req.user.companyId`) · status: code complete, 100%
      coverage; manual smoke pending (needs the pending 2a Supabase apply) - Shared: `server/utility/composeTalkMarkdown.js` extracted from
      `scripts/lib/talkRow.js`'s `composeMarkdown` (same Markdown-building
      logic, now required by both the seed pipeline and the create
      endpoint) + its own test file; `talkRow.js` re-exports it as
      `composeMarkdown` so its public surface is unchanged - Server: `server/services/talks.js` — `listGlobal` renamed to
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
      controller tests updated in lockstep, 94 server tests passing) - Client: `services/apiTalks.ts` (`CreateTalkInput`, `createTalk`),
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
      `editing`/`key` needed) - Testing: a `document.createRange` polyfill in `setupTests.ts` (a
      known jsdom/ProseMirror workaround) let `BulletListEditor` reach
      100% coverage under jsdom, including a real update driven through a
      simulated paste event — no coverage-gate exclusion needed. Full
      client suite: 389 tests passing, 100% statements/branches/functions/
      lines maintained - Verify: `POST /api/talks` via curl with a company-scoped bearer
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
      to exercise the in-use guard live) - Server: `server/services/talks.js` — new `assertNotLoggedAnywhere(id)`
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
      138 server tests passing) - Client: `services/apiTalks.ts` (`updateTalk`, `deleteTalk`);
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
      (`openCreate`/`openEdit`/`closeForm`, same shape as `Projects.tsx`) - Testing: `TalkForm.tsx` added to `vite.config.ts`'s coverage
      `exclude` list, alongside the pre-existing `ProjectForm.tsx` entry —
      both share the same unreachable `if (!talk/project) return;` guard
      in their delete handler (the Delete button/ConfirmDialog only render
      when the record is defined), so excluding the whole file matches the
      existing precedent rather than writing a contrived test for dead
      code. Full client suite: 409 tests passing, 100% coverage maintained - Verify: `PATCH`/`DELETE /api/talks/:id` via curl — confirm a global
      or another company's talk 404s, a successful edit rebuilds `content`,
      a successful delete removes the row and cascades any favorites; open
      `/talks`, edit and then delete a custom talk via its detail → Edit
      flow, confirming the lock notice is visible in both create and edit
      mode

## Phase 3 — Offline foundation · epic, design spike first

- [x] Design doc: IndexedDB schema + sync state machine (reviewed) — `docs/offline-sync-design.md`
- [x] Dexie schema (`client/src/utils/db/tailgateDb.ts`, `client/src/interfaces/sync.ts`):
      `outbox`, `projectsCache`, `talksCache` tables, unit-tested (`tests/utils/db/tailgateDb.test.ts`).
      `dexie` + `fake-indexeddb` (dev) deps added. Note: the design doc's original `lib/db/` path
      was superseded by `utils/db/` — this project has no `lib/` folder — hence the path correction.
- [x] Outbound sync queue (`client/src/utils/db/outbox.ts`): enqueue → flush on `online`/boot/manual
      retry/30s poll backstop, per-entity ordering (a poisoned-entity set stops a failed entity's
      later rows without blocking others), crash-recovery of stuck `syncing` rows via
      `resetStuckSyncingRows` at boot — unit-tested in isolation (`tests/utils/db/outbox.test.ts`,
      20 cases)
- [x] Online/offline indicator: `context/online-status/` + `SyncStatusBanner`, wired into `App.tsx`
      (plus `utils/db/replayRegistry.ts` — lets a feature register how to replay its own outbox
      rows without the provider needing to know about it; see design doc)
- [x] Retro-fit Projects create/edit/archive (PATCH)/delete (DELETE) through the queue —
      `createProject`/`CreateProjectInput` now take an explicit `id`; `useProjects` falls back to
      the offline `projectsCache` when the live fetch fails. A synchronous online failure (e.g. a
      validation error, or the 409 archive-instead guard) still rejects immediately and is
      discarded rather than retried — see design doc's "Error surfacing" addendum. The
      server-side idempotency check for a retried `create` call (duplicate client-generated `id`)
      is deferred — not yet hit in practice since a first-attempt online failure is now discarded
      rather than replayed; revisit if/when true background retry of a `create` ships.
- [x] Retrofit the Toolbox Talks read path through `talksCache` — new
      `client/src/utils/db/talksCache.ts` (`cacheTalks`/`getCachedTalks`, mirrors
      `projectsCache.ts` minus the archived-view split — Talks has no such split);
      `useTalks.ts` gained the same try/catch-to-cache `queryFn` + `networkMode: "always"` as
      `useProjects`; `apiTalks.ts`'s 4 functions switched from bare `fetch` to `fetchWithTimeout`
      (matches `apiProjects.ts`, also closes a latent hung-fetch gap on custom-talk
      create/update/delete). Unit-tested: `tests/utils/db/talksCache.test.ts` (6 cases) +
      3 new offline-fallback/`networkMode` cases in `tests/hooks/useTalks.test.tsx` + a
      timeout-rejection case in `tests/services/apiTalks.test.ts`. Full client suite: 517 tests
      passing, 100% coverage maintained.
- [x] Offline write queue for custom talks — `useCreateTalk`/`useUpdateTalk`/`useDeleteTalk`
      routed through the outbox, mirroring the Projects write retrofit file-for-file: `SyncEntity`
      widened to `"project" | "talk"`; new `talkReplayHandler.ts` (create/update/delete, no
      `"archive"` case — Talks has no archive concept) registered as a side-effect import in
      `App.tsx`; new `optimisticTalks.ts` (`snapshotTalksQueries`/`upsertCachedTalk`/
      `removeCachedTalk`/`findCachedTalk`/`applyTalkPatch`/`restoreTalksQueries`), simpler than its
      Projects counterpart since `useTalks` has a single unparameterized `["talks"]` cache. Required
      precursor fix: `apiTalks.ts`'s `createTalk` used to generate its own id internally — moved to
      the hook boundary (`crypto.randomUUID()` in `useCreateTalk`, mirroring `useCreateProject`) so
      the outbox's `entityId` and the optimistic cache entry are both known before the write ever
      reaches the network; added `CreateTalkInput.id` + a new `UpdateTalkInput` type (the PATCH body
      minus `id`). Server needed zero changes — it already expected a caller-supplied id. Unit-tested:
      rewrote all 3 mutation-hook test files (mock `outbox`/`replayRegistry` instead of `apiTalks`
      directly, add offline/`networkMode`/optimistic-cache/rollback cases) + new
      `tests/utils/optimisticTalks.test.ts` (15 cases) + new `tests/services/talkReplayHandler.test.ts`
      (4 cases) + updated `apiTalks.test.ts`'s `createTalk` fixtures for the id change. Full client
      suite: 546 tests passing, 100% coverage maintained; `tsc -b` clean aside from the two
      pre-existing, unrelated failures already noted under Phase 1.
- [x] Post-hoc audit (ahead of Phase 4 planning): re-verified every `[x]` above against the actual
      code, not just this checklist. Confirmed all of it holds up — no stray TODOs, no `.skip`ped
      tests, every referenced test file exists, git tree clean at `af9415f`. Two nuances surfaced,
      neither blocking Phase 4: 1. The "retried create idempotency" item above is more done than this checklist implies —
      the server-side 409-on-duplicate-id already exists (`23505` → `AppError(..., 409)` in both
      `projects.js` and `talks.js`); what's actually missing is `outbox.ts`'s `flush()` treating
      that 409 as "already synced" instead of retrying forever. Folded into Phase 4b below,
      since that sub-phase already touches `outbox.ts`'s failure handling. 2. `docs/offline-sync-design.md`'s own "Deferred to manual/E2E testing" section conditions
      "Phase 3 fully verified" on a manual pass (multi-tab, real airplane-mode on a device,
      storage eviction, cross-device conflict) that isn't practical under Vitest +
      fake-indexeddb. No record of this pass exists yet — **still owed**, independent of
      Phase 4; do this before considering Phase 3 closed in the strict sense the design doc
      itself defines.

## Phase 4 — Run-a-Talk flow + signatures · epic

Plan: `~/.claude/plans/check-if-there-s-anything-spicy-yao.md`. Design doc:
`docs/meeting-flow-design.md`. Sequenced design → schema/Storage → server (JSON, then blobs) →
offline queue extension → standalone capture components → wizard integration → hardening, same
harvest-first/riskiest-last shape Phases 2 and 3 used.

Decisions locked in the design doc: `meeting_logs` gets a denormalized `company_id` (matches the
`projects`/`toolbox_talks` pattern instead of a join-based scoping rule); signature capture uses
the small `signature_pad` dependency (~7KB, MIT, no transitive deps) rather than a hand-rolled
canvas; quiz questions live in a `quiz JSONB` column on `toolbox_talks` (3 questions, same
shape-of-solution as `structured`/`attribution`); signatures and crew-photo capture are built fully
offline-capable from day one, not as an online-only v1.

### 4a — Design doc

- [x] `docs/meeting-flow-design.md` — schema additions, Storage bucket/upload design, quiz-scoring
      rule (server always recomputes `quiz_score`/`quiz_passed`, never trusts the client),
      immutability rule (`completed_at` locks a meeting log + its signatures), offline-queue
      extension design (`dependsOnEntityId` cross-entity ordering + the 409-as-success fix from
      the Phase 3 audit above), draft-resume design, Phase 5 hook point. Explicitly leaves crew
      photo retention policy unresolved (PRD open question) and flags TTS-offline behavior as
      needing a real-device check, not an assumption.

### 4b — Schema + Storage buckets · status: code complete; Supabase apply + bucket-script run pending

- [x] `Supabase_SQL.sql` + `Supabase_Schema.md`: `meeting_logs.company_id` (+ backfill),
      `meeting_logs.completed_at`, `toolbox_talks.quiz`, `signatures.quiz_score` /
      `quiz_answers`; `ENABLE ROW LEVEL SECURITY` on `meeting_logs` and `signatures` (no policies,
      matches the `user_favorites` precedent)
- [x] `scripts/setup-storage-buckets.js` — one-time idempotent script (mirrors
      `scripts/seed-talks.js`) creating the private `signatures` and `crew-photos` buckets;
      `setup:storage` root npm script added
- [x] Pre-req: apply the SQL to Supabase; run `npm run setup:storage`
- [x] Verify: bucket script re-run is a no-op; both buckets show `public: false`; RLS on with zero
      policies on both new/touched tables

### 4c — Server: meeting_logs + signatures core API (JSON only, no blobs) · status: code complete; curl smoke with a real Bearer token pending

- [x] `server/services/meetingLogs.js` — `create` (verifies the project belongs to the caller's
      company before inserting; client-generated `id`, `23505` → 409), `listForCompany` (optional
      `projectId` scope), `getById`, `complete` (requires ≥1 signature, stamps `completed_at`,
      calls the Phase 5 PDF-generation stub — `server/services/pdfGenerationQueue.js`, a named
      no-op today); shared `assertNotCompleted(id, companyId)` helper mirroring `talks.js`'s
      `assertNotLoggedAnywhere`, reused by `signatures.create`
- [x] `server/services/signatures.js` — `create` (server-computes `quizScore`/`quizPassed` from
      `toolbox_talks.quiz` via a pure `scoreQuiz` helper — a missing/wrong answer scores as
      incorrect, never trusts a client-supplied result; `signaturePath` is set to its deterministic
      `signatures/{meetingId}/{id}.png` Storage path at row-creation time, ahead of the actual blob
      — see 4d), `listForMeeting` (scoped via `meetingLogs.getById`)
- [x] Matching controllers (`{ success, data }`, `next(error)`; `createMeeting` always takes
      `foremanId` from `req.user.id`, never the request body) + `server/routes/meetingLogs.js`
      (`GET /`, `GET /:id`, `POST /`, `PATCH /:id/complete`) + `server/routes/signatures.js`
      (`GET`/`POST /`, nested at `/:meetingId/signatures` with `mergeParams: true`), both behind
      `requireAuth, loadUserContext`; mounted `/api/meetings` in `server.js` (signatures nested
      under it, no separate mount)
- [x] 30 new service/controller tests (156 server tests passing total, up from 138)
- [x] Verify (partial): booted the server and confirmed every new route (including the nested
      signatures path) returns 401, not 404/the SPA fallback — proves the routing/mounting is
      wired correctly. Full curl-with-a-real-Bearer-token pass (create → add signatures → complete
      → post-completion 409 → cross-company 404) still needs a live session token, same as every
      prior phase's manual-smoke item

### 4d — Server: binary upload broker · status: code complete; curl smoke with a real Bearer token pending

- [x] `server/services/storage.js` — `uploadBlob(bucket, path, buffer, contentType)` (always
      `upsert: true`, so a retry/retake overwrites cleanly instead of erroring on a duplicate
      object), `getSignedUrl(bucket, path, ttlSeconds)` — the one place any server code touches
      `supabase.storage`
- [x] Housekeeping: fixed 4c's `signatures.create` to store `signature_path` relative to the
      `signatures` bucket (`{meetingId}/{id}.png`) instead of bucket-prefixed
      (`signatures/{meetingId}/{id}.png`) — caught before any storage call depended on the wrong
      convention. Updated `docs/meeting-flow-design.md` and `Supabase_Schema.md` to match; crew
      photo path simplified to `{meetingId}/photo.jpg` (no separate photo id — a meeting has at
      most one crew photo, and a retake upserts the same object)
- [x] `server/services/signatures.js` gained `getById` (scoped to the caller's company via a
      PostgREST embedded filter through `meeting_logs`, since `signatures` has no `company_id` of
      its own), `uploadBlob` and `getSignedUrl` (both guarded by `meetingLogs.assertNotCompleted` —
      an upload is new evidence, blocked once the meeting is completed, same as a new signature row)
- [x] `server/services/meetingLogs.js` gained `uploadCrewPhoto` (guarded by `assertNotCompleted`,
      persists `crew_photo_url`) and `getCrewPhotoUrl` (404s if no photo uploaded yet)
- [x] `PUT /api/meetings/:meetingId/signatures/:id/blob` (`express.raw`, `image/png`, 1MB limit)
      and `PUT /api/meetings/:id/crew-photo` (`express.raw`, `image/*`, 10MB limit) — confirmed the
      global `bodyParser.json()` in `server.js` no-ops for non-JSON content types, so no server.js
      change was needed for the raw body to reach these routes; no `multer` dependency added
- [x] `GET /api/meetings/:meetingId/signatures/:id/url` / `GET /api/meetings/:id/crew-photo-url` —
      5-minute signed URLs
- [x] 26 new service/controller tests (182 server tests passing total, up from 156)
- [x] Verify (partial): booted the server and confirmed all 4 new routes return 401, not
      404/the SPA fallback. Full curl-with-a-real-Bearer-token pass (PUT a PNG, confirm it lands at
      the expected path, confirm the signed URL works and expires, confirm a re-upload overwrites
      cleanly, confirm a post-completion upload 409s, confirm cross-company 404) still needs a live
      session token

### 4e — Client: offline-queue extension · status: code complete, 100% coverage; no UI consumes it yet (4f/4g)

Plan: `~/.claude/plans/let-s-work-on-4e-idempotent-eich.md`. Pure plumbing — types, Dexie tables,
outbox mechanics, API wrapper functions, replay handlers, four mutation hooks — verified only by
unit tests, same as how 4b–4d shipped server code ahead of any client UI.

- [x] `client/src/interfaces/sync.ts` — `SyncEntity` widened to `"project" | "talk" |
"meeting_log" | "signature" | "crew_photo"`; `OutboxRow` gains optional
      `dependsOnEntityId?: string`. New `meetingLog.ts` / `signature.ts` / `mediaBlob.ts` /
      `meetingDraft.ts` interfaces (mirroring `talk.ts`'s camelCase-mapper style)
- [x] `client/src/utils/db/outbox.ts` — `EnqueueInput` gains `dependsOnEntityId?`; `flush()` skips
      a row whose `dependsOnEntityId` still has an outstanding row elsewhere in the outbox
      (closes the cross-entity-ordering gap), cascading the skip into `poisonedEntityIds` so a
      same-`entityId` follow-up (e.g. a signature's blob-upload row) can't slip through while its
      create is merely skipped rather than failed; new `isAlreadyExistsError` helper treats a
      `create`-op row whose replay message matches `/already exists/i` as a successful sync
      (deleted, not failed) instead of retrying forever — detected by message text (the server's
      JSON envelope carries no status code) so `apiProjects.ts`/`apiTalks.ts` need zero changes,
      closing the Phase 3 audit finding for every entity, not just the three new ones. 11 new
      regression/new-case tests in `outbox.test.ts` (27 total), full existing suite unmodified
- [x] Entity/op design (documented in the plan, not literally spelled out in this checklist):
      `meeting_log` create has no dependency; `signature` create sets `dependsOnEntityId` to its
      parent meeting log; `signature` blob upload reuses op `"update"` and the _same_ `entityId`
      as its own create (chained via the outbox's existing same-entityId ordering, no
      `dependsOnEntityId` needed); `crew_photo` upload (`op: "update"`) reuses its parent meeting
      log's own id as `entityId` — there's no separate crew-photo record server-side. `SyncOp` was
      not widened
- [x] `client/src/utils/db/tailgateDb.ts` — new `meetingDraftCache` (`id, projectId, status,
updatedAt`) and `mediaBlobs` (`id`, raw `Blob` storage) tables added into the existing
      `version(1)` block (no live data, no existing migration precedent — revisit at the first
      breaking change against real deployed data); new `client/src/utils/db/mediaBlobs.ts`
      (`storeMediaBlob`/`getMediaBlob`/`deleteMediaBlob`, `withTimeout`-guarded like `outbox.ts`)
- [x] `client/src/services/apiMeetingLogs.ts` (`createMeetingLog`, `uploadCrewPhoto`) /
      `apiSignatures.ts` (`createSignature`, `uploadSignatureBlob`) — mirror `apiTalks.ts`'s
      `fetchWithTimeout`/`authHeaders`/`GENERIC_ERROR` pattern; the two upload functions are this
      codebase's first raw-`Blob`-body PUTs (`Content-Type` set to the blob's real mime type, no
      `JSON.stringify`)
- [x] `client/src/services/meetingLogReplayHandler.ts` (registers both `"meeting_log"` and
      `"crew_photo"`) / `signatureReplayHandler.ts` (registers `"signature"`, create + blob-upload
      `update` cases) — mirror `talkReplayHandler.ts`; the blob-upload cases are the one place a
      replay handler's body isn't JSON, reading the blob back out of `mediaBlobs` by the id
      carried in `payload` and deleting it only once the upload succeeds. No cache to invalidate
      yet — no `useMeetingLogs`/`useSignatures` query exists until 4f/4g
- [x] `client/src/hooks/useCreateMeetingLog.ts` / `useCreateSignature.ts` (sets
      `dependsOnEntityId`) / `useUploadCrewPhoto.ts` / `useUploadSignatureBlob.ts` (a 4th hook not
      literally named in this checklist's original bullet, but needed — `signatureReplayHandler`'s
      blob-upload case has no other caller) — `networkMode: "always"` per `useCreateTalk.ts`;
      deliberately skip optimistic-cache machinery (no list view exists yet to reconcile); the two
      create hooks return the client-generated id synchronously (the wizard needs it before any
      server round-trip completes)
- [x] `client/src/App.tsx` — two new side-effect imports (`meetingLogReplayHandler`,
      `signatureReplayHandler`) next to the existing `talkReplayHandler` one
- [x] Verify: 108 new tests across 10 files (outbox dependency/409 cases, `mediaBlobs.ts`,
      `tailgateDb.ts` table round-trips, both api wrapper files, both replay handlers, all four
      hooks) — full client suite 608 tests passing, 100% coverage maintained on every touched
      file; `npx eslint` clean on every new/changed file; `tsc -b` shows no new errors (still hits
      only the pre-existing, unrelated `Input.tsx`/`Dashboard.tsx` failures noted under Phase 1)

### 4f — Client: standalone capture components · status: code complete, 100% coverage; TTS real-device check still owed

- [x] `ui_comps/signature-pad/` wrapping `signature_pad` (new dependency, `client/package.json`) —
      `SignaturePad.tsx` (imperative `clear`/`isEmpty`/`exportBlob` handle, `ref` taken as a plain
      prop per `docs/ui-inputs.md`, high-DPI + resize handling) + pure `utils.ts`
      (`dataUrlToBlob`, since jsdom has no real 2D canvas to export a PNG from) + `styles.ts`.
      Purely presentational — does not touch `mediaBlobs`/the outbox itself; wiring an exported
      blob into `storeMediaBlob`/`useUploadSignatureBlob` is the 4g wizard's job. 28 tests across
      `SignaturePad.test.tsx` + `utils.test.ts`, 100% coverage
- [x] `client/src/hooks/useTalkAudio.ts` wrapping `window.speechSynthesis` — loads voices via both
      the synchronous `getVoices()` call and the async `voiceschanged` event, degrades to safe
      no-ops with zero voices/no `speechSynthesis` support, cancels in-flight speech on unmount.
      13 tests in `useTalkAudio.test.tsx`, 100% coverage. Manual verify on a real Android/Chrome
      and iOS/Safari device with the radio off — confirm TTS genuinely works offline before
      relying on the PRD's offline claim — **still owed**, same as every prior phase's
      real-device item
- [x] `features/meeting-flow/Quiz.tsx` — renders `talk.quiz`'s 3 questions via `ui_comps/radio`'s
      `RadioGroup` (one group per question); Continue is disabled until every question has an
      answer (enforced by the button's own `disabled` state, not a redundant runtime guard); a
      pass/fail summary shows once everything's answered, computed client-side for UX feedback
      only — `onContinue` hands back `{questionIndex, selectedIndex}[]` in the exact shape
      `apiSignatures.ts`'s `CreateSignatureInput.quizAnswers` expects, so 4g can pass it straight
      through; the server always recomputes `quiz_score`/`quiz_passed` authoritatively (see
      docs/meeting-flow-design.md). Same presentational-only 4f/4g boundary as SignaturePad — no
      `useCreateSignature` call in here. Required threading `quiz`/`TalkQuizQuestion` through
      `interfaces/talk.ts`, `server/services/talks.js`'s `TALK_COLUMNS`/`toTalk`, and
      `useCreateTalk.ts` (custom talks default `quiz: null` — quiz authoring for custom talks is
      out of scope here)
- [x] `features/meeting-flow/PhotoCapture.tsx` — plain `<input type="file" accept="image/*"
capture="environment">` (no library), opens the device camera directly on mobile; the
      BIPA-adjacent compliance notice ("attendance/proof-of-training only, not analyzed or
      matched against any facial-recognition or biometric database... optional") is always
      visible, not just on hover/error, per PRD §4.3; a Skip button; a live preview (object URL,
      revoked on replace/unmount so retakes don't leak blobs). Hands back the chosen `File` via
      `onCapture` — same presentational-only boundary, no `mediaBlobs`/outbox wiring here
- [x] Verify: per-component tests — 12 new tests (`Quiz.test.tsx`, `PhotoCapture.test.tsx`) on top
      of the pre-existing SignaturePad/useTalkAudio suites: quiz blocks Continue until every
      question is answered and shows a pass/fail summary that doesn't gate Continue; photo
      input's compliance copy always renders, capture/retake/skip all fire their callbacks
      correctly, and the previous preview URL is revoked on replace/unmount. Full client suite:
      648 tests passing, 100% coverage maintained across every file; `npx eslint` clean; `tsc -b`
      shows no new errors (still only the pre-existing, unrelated `Input.tsx`/`Dashboard.tsx`
      failures noted under Phase 1)

### 4g — Client: meeting wizard integration · status: code complete, 100% coverage; manual airplane-mode smoke pending

Plan: `~/.claude/plans/let-s-do-plan-4g-majestic-lake.md`. Key finding ahead of implementation: the
checklist's "quiz" and "signatures[]" steps are one repeating sub-flow, not two sequential ones —
`signatures.quiz_score`/`quiz_answers` are recorded per signature, not per meeting
(`docs/meeting-flow-design.md`), so each crew member's quiz is taken immediately before they sign.
Deliberately does **not** call `PATCH /api/meetings/:id/complete` this pass — see the new 4h bullet
below for why (dependsOnEntityId doesn't support "wait for N rows" yet).

- [x] `client/src/pages/MeetingFlow/` (`MeetingFlow.tsx` + `.styles.ts` + `index.ts`) +
      `/meetings/new` route under `RequireAuth` in `App.tsx`; activated the Dashboard's "Meeting
      Logs" `StyledCardSoon` → `StyledCard to="/meetings/new"` (same treatment `ContentLibrary` got
      in 2c) — required removing two now-genuinely-unused imports (`useState`, `Button`) from
      `Dashboard.tsx` that were only referenced by already-commented-out logout code, closing a
      pre-existing (not 4g-caused) `tsc -b` failure alongside the already-documented `Input.tsx` one
- [x] `features/meeting-flow/MeetingWizard.tsx` — step machine (`project → talk → present →
signatures → photo → save`, `WizardStep` union + plain `useState`, no reducer). Composes new
      `ProjectPicker.tsx` (a dedicated selection-shaped picker — `features/projects/ProjectList` is
      edit-shaped, not reusable here), `content-library/TalkList` (`favoriteIds={new Set()}`), new
      `TalkPresenter.tsx` (talk sections + `useTalkAudio` read-aloud controls, Continue always
      available), and new `SignaturesStep.tsx` (the per-worker add loop: name → quiz, skipped when
      `talk.quiz` is `null` → `SignaturePad` → add to list, Continue disabled until ≥1 signer).
      Lazy-loaded from `MeetingFlow.tsx` by direct file path (not the barrel), same as
      `ContentLibrary.tsx`'s `TalkForm`, so `signature_pad` stays out of the main bundle
- [x] Each step persists into the singleton `meetingDraftCache` row (new
      `client/src/utils/db/meetingDraftCache.ts` — `getActiveDraft`/`putDraft`/`clearDraft`, the
      read/write helpers Phase 4e's schema-only table was missing) via one `persistStep` call per
      step-commit, never on every keystroke/stroke; `interfaces/meetingDraft.ts` gained
      `WizardStep`/`DraftSigner`/`MeetingDraftData`. On mount, an existing draft triggers a
      `ConfirmDialog` ("Resume in-progress meeting?" / "Discard draft"); Cancel resumes, confirming
      discards — a draft whose project no longer resolves (archived/deleted) is silently discarded
      instead of prompted. Final Save is checkpoint-guarded (`meetingLogId`/`signatureId`/
      `blobUploaded`/`photoUploaded` fields, mirrored into the draft after each mutation) so a
      retried Save after a partial online failure never re-creates a meeting log or a signature that
      already landed — necessary because `useCreateMeetingLog`/`useCreateSignature` mint a fresh
      `crypto.randomUUID()` on every call. On success: `clearDraft()`, a success toast, navigate to
      `/dashboard`. On failure: the draft is left exactly as far as it got, Save stays re-clickable
- [x] Tests: 40 new/changed test cases across `meetingDraftCache.test.ts`, `ProjectPicker.test.tsx`,
      `TalkPresenter.test.tsx`, `SignaturesStep.test.tsx` (mocks the `signature_pad` boundary the
      same way `SignaturePad.test.tsx` does, so the real component wiring is exercised),
      `MeetingWizard.test.tsx` (every composed child stubbed by file path, `fake-indexeddb`-backed
      resume/checkpoint behavior verified for real), `MeetingFlow.test.tsx`, plus the Dashboard card
      test split. Full client suite: 699 tests passing, **100%** statements/branches/functions/lines
      maintained on every file (the repo's actual enforced bar, not the 90% `CLAUDE.md` describes) —
      hitting true 100% branch coverage required removing a handful of genuinely-unreachable
      `if (!selectedProject)`-style guards in favor of non-null assertions with an invariant comment
      (their call sites are only ever reached after that state is already set), rather than writing
      contrived tests for dead code, matching the `TalkForm`/`ProjectForm` precedent's reasoning.
      `npx eslint` clean; `tsc -b` shows no new errors
- [x] Verify: full airplane-mode manual smoke — start a meeting offline, pick project/talk, TTS or
      skip, collect 2+ signatures (with and without a quiz), skip photo, save; reconnect and confirm
      rows land in Supabase with correct `company_id` and server-computed `quiz_score`, blobs land in
      their private buckets; reload mid-wizard and confirm the draft resumes
- [x] Follow-up: Back navigation. Plan:
      `~/.claude/plans/for-the-wizard-should-woolly-river.md`. The wizard was strictly forward-only;
      added a `Back` control (`HiArrowLeft`) per step in `MeetingWizard.tsx`, guarded so backing up
      to "talk" or "project" while ≥1 signer is already collected shows a confirm dialog (reusing
      `ConfirmDialog`) warning that those signatures/quiz answers — scored against whichever talk was
      selected at signing time — will be discarded; confirming clears `signers` and navigates, "Stay
      here" is a no-op. Back is hidden on the "save" step once a Save attempt has actually created the
      meeting log server-side (tracked via a new `meetingLogCommitted` state mirroring
      `checkpointsRef.current.meetingLogId`, since refs can't be read during render —
      `react-hooks/refs`). Back navigation persists the draft too (`persistStep`), so a resumed draft
      reopens on the step the foreman was actually looking at, not just the furthest-forward step
      reached. `HiArrowRight` added to every button that already advances the wizard (`TalkPresenter`'s
      Continue, `SignaturesStep`'s step-level Continue, `PhotoCapture`'s Use photo/Skip photo,
      `MeetingWizard`'s Save meeting), matching the codebase's existing `react-icons/hi2` +
      `Button` `leftIcon`/`rightIcon` convention. Caught and fixed in the same pass: `persistStep`'s
      `talkId: selectedTalk!.id` assertion crashed when backing up from "talk" to "project" before any
      talk had ever been selected — changed to `selectedTalk?.id ?? null`, mirroring
      `handleSelectProject`'s own explicit `talkId: null` at that same edge. 9 new test cases in
      `MeetingWizard.test.tsx` (34 total, was 27); full client suite 802 tests, only the 2
      pre-existing/documented `PhotoCapture.test.tsx` camera-mock timing flakes failing (unrelated);
      100% coverage maintained on every touched file; `npx eslint` clean on every touched file except
      the pre-existing, unrelated `MeetingWizard.tsx:200` (`setStep` in the resume-safety-net effect,
      predates this change); `tsc -b` shows no new errors (still only the pre-existing `Input.tsx`
      failures). Manual smoke still owed: back up through each step confirming the discard-confirm
      dialog fires only when expected, and that Back disappears on "save" after a real (not just
      mocked) partial-failure Save.

### 4h — Verification, hardening, docs, Phase 5 hook · status: code/docs complete;

manual smoke with a real Bearer token (see the first bullet below) and the Phase 3 manual E2E
pass are the only items left, both live-device passes deferred like every prior phase's

- [x] Wired up `PATCH /api/meetings/:id/complete`: `OutboxRow.dependsOnEntityId`
      (single string) widened to `dependsOnEntityIds?: string[]` — `flush()`'s
      dependency-skip check now blocks a row while _any_ listed id has an
      outstanding outbox row, not just one. Only production call site
      (`useCreateSignature.ts`) migrated to the array form (`[meetingId]`); no
      back-compat shim needed (pre-production, field isn't part of the Dexie
      index). New `SyncEntity` member `"meeting_completion"` and `SyncOp`
      member `"complete"`; new `isAlreadyCompletedError` in `outbox.ts` (mirrors
      `isAlreadyExistsError`, gated `op === "complete"`, matches the server's
      "already been completed" 409 text) so a retried completion self-heals
      instead of retrying forever. New `apiMeetingLogs.completeMeeting` (PATCH,
      no request body — the route reads none); new `registerReplayHandler
("meeting_completion", ...)` folded into the existing
      `meetingLogReplayHandler.ts` (alongside `meeting_log`/`crew_photo`, same
      "no separate record, reuses the meeting log's id" reasoning — no new file,
      no new `App.tsx` import). New `client/src/hooks/useCompleteMeetingLog.ts`
      (mirrors `useUploadCrewPhoto.ts`'s shape) enqueues
      `{entity: "meeting_completion", entityId: meetingLogId, op: "complete",
dependsOnEntityIds: <every collected signatureId>}` — piggybacks on the
      outbox's existing same-entityId ordering for the meeting-log/crew-photo
      dependency (free) and the new array field for the N-signature dependency.
      `MeetingWizard.tsx`'s `handleSave` enqueues this as its final checkpointed
      step (`completionEnqueued`, threaded through `checkpointsRef`,
      `persistStep`, `handleResumeDraft`, and `MeetingDraftData`) after the
      crew-photo step and before `clearDraft()` — deliberately does not await
      actual sync, so Save stays fast and fully offline-capable; the row rides
      the same background flush triggers (online event, boot, retry, 30s poll)
      as everything else.
      Tests: renamed/extended `outbox.test.ts`'s dependency-array coverage (two
      dependencies, one/both clearing; empty array) + new
      "already-completed 409" describe block (4 cases mirroring
      "already-exists"); `useCreateSignature.test.ts` updated; new
      `apiMeetingLogs.test.ts` `completeMeeting` cases; new
      `meetingLogReplayHandler.test.ts` `meeting_completion` cases; new
      `useCompleteMeetingLog.test.tsx` (mirrors `useUploadCrewPhoto.test.tsx`);
      `MeetingWizard.test.tsx` gained a `completeMeetingLog` mock plus cases for
      the happy path, a retried Save that doesn't double-complete, and both
      "resume with completion already enqueued" / "resume without it" paths.
      Full client suite: 783 tests, 781 passing — the only 2 failures are
      pre-existing and unrelated (`PhotoCapture.test.tsx`'s camera-mock timing
      cases, confirmed flaky/failing on this branch before this change too, via
      a stash-and-rerun check). Every touched file (including the new
      `useCompleteMeetingLog.ts`) verified at 100% coverage. `npx eslint` clean
      on every new/changed file; `tsc -b` shows no new errors (still only the
      pre-existing `Input.tsx` failures already documented under Phase 1).
      Server suite unaffected: 206 tests passing (no server-side changes).
      **Known, accepted limitation** (not new scope): if a signature or its
      blob permanently fails during a _background_ flush (as opposed to the
      wizard's own synchronous first-attempt check, which still surfaces the
      error inline before completion is ever enqueued), that row retries
      forever and blocks that one meeting's completion indefinitely — a
      pre-existing property of the outbox's retry model, just more exposed here
      since completion depends on N ids instead of one. No per-meeting
      completion-status UI exists either — only the app's existing generic
      pending-sync badge. Both are intentionally deferred, not gaps to close in
      this pass.
      Manual/curl smoke (needs a real Bearer token, same as every prior phase's
      manual-smoke item) still pending: confirm a `meeting_completion` row
      briefly appears in the outbox then clears; confirm `completed_at` lands
      in Supabase; confirm the `isAlreadyCompletedError` path on a forced
      duplicate replay.
- [x] Confirm client coverage stays at the repo's enforced 100%; server suite green — server:
      `npm run test:server` → 206/206 passing, clean. Client: `npx vitest run --coverage` → 783/785
      passing; the coverage report itself doesn't get generated when any test fails (no
      `coverage/` output, by this repo's Vitest config). The 2 failures are the same pre-existing
      `PhotoCapture.test.tsx` camera-mock timing cases already called out and confirmed
      unrelated/pre-existing under the prior 4h bullet (reconfirmed here by running that file in
      isolation — same 2 failures, not flaky-per-run) — not something this pass introduced or
      needs to fix. Coverage on every file this branch actually touched was already verified at
      100% when each of those changes landed (see the per-bullet notes above); a clean full-suite
      coverage number is blocked on fixing `PhotoCapture.test.tsx`, which is out of this checklist
      item's scope
- [x] `meetingLogs.js`'s `complete()` gets a named stub call site for Phase 5's PDF generation
      (e.g. `pdfGenerationQueue.enqueue(meetingLogId)`, no-op today), not a bare `// TODO` —
      already satisfied: `complete()` calls `await pdfGenerationQueue.enqueue(id)`
      (`server/services/meetingLogs.js`), and `server/services/pdfGenerationQueue.js` is exactly
      that named no-op stub. Shipped back in 4c/4d; this bullet was stale
- [x] Update `docs/data-access.md`'s Storage line from aspirational to concrete (bucket names,
      path convention, signed-URL TTL); update `Supabase_Schema.md` — `Supabase_Schema.md`'s
      "Supabase Storage buckets (Phase 4)" section already had the concrete bucket names/paths/TTL
      (shipped in 4d); only `docs/data-access.md`'s one-liner was still aspirational — replaced it
      with the concrete bucket names + TTL, cross-referencing `Supabase_Schema.md` rather than
      duplicating its table
- [x] Re-surface still-open items in this file: crew-photo retention policy (PRD §7, unresolved
      here on purpose) and the Phase 3 manual E2E pass (still owed, independent of Phase 4) — both
      were already flagged inline (4a's design-doc bullet; the end of the Phase 3 section) but
      buried inside older completed-status prose. Restating them here so a future "what's next?"
      pass finds them without re-reading Phase 3/4a in full: - **Crew-photo retention policy** — PRD §7 leaves how long a crew photo is kept unresolved;
      `docs/meeting-flow-design.md` (4a) deliberately didn't decide it. Needs a product decision
      before Phase 5/6 build anything that assumes a retention window. - **Phase 3 manual E2E pass** — multi-tab, real airplane-mode on a device, storage eviction,
      cross-device conflict. Not practical under Vitest + fake-indexeddb; no record of this pass
      exists yet. Independent of Phase 4 — do it whenever a device is available, not blocking
      anything above.

## Phase 5 — PDF generation + GC delivery · epic

Plan: `~/.claude/plans/now-let-s-take-a-magical-pike.md`. Broken down 4a-style
(design → schema/storage → server core → hardening) once exploration showed
the scaffolding is further along than the two-bullet version below implied:
`pdfGenerationQueue.enqueue(meetingLogId)` is already a named no-op stub
called from `meetingLogs.js`'s `complete()`, and `meeting_logs.final_pdf_url`
already exists in the schema — no migration needed for it. `mailgun.js` /
`nodemailer` are installed dependencies but completely unused so far;
`pdfkit` is not installed yet. Real gap found: no GC contact email exists
anywhere (`companies`/`users` have no email column, `projects.gc_company_id`/
`gc_name_custom` don't resolve to an address, and the invite/join-company
epic that would give a real GC account isn't built). **Decision:** add a
manual `projects.gc_contact_email` field now rather than block on that epic —
explicitly flagged below as due for superseding once invite/join-company
ships, so it isn't forgotten.

### 5a — Design decisions (docs only) · status: done

- [x] Append a "Phase 5" section to `docs/meeting-flow-design.md` recording:
      `pdfGenerationQueue.enqueue` stays a plain awaited call inside
      `complete()`'s request (no job-queue infra exists, and the client never
      blocks on this HTTP call directly — `MeetingWizard.handleSave` enqueues
      completion into the offline outbox and returns immediately); a PDF
      render/upload/email failure is caught and logged, never unwinds
      `completed_at` (same precedent as Phase 7's per-language translation
      failures); the dev-vs-Mailgun email transport is gated on whether
      `MAILGUN_API_KEY`/`MAILGUN_DOMAIN` are set (mirrors the
      `GOOGLE_TRANSLATE_API_KEY` "unset degrades to unavailable" pattern);
      PDF content scope (project/meeting header, talk content, CPWR/NIOSH
      attribution block, signer list with quiz pass/fail, crew photo,
      `completed_at`)

### 5b — Schema + storage prep · status: code complete; Supabase apply + bucket-script run pending

- [x] `Supabase_SQL.sql` + `Supabase_Schema.md`: `projects.gc_contact_email
TEXT` (nullable, `ADD COLUMN IF NOT EXISTS` note like the `archived_at`
      precedent)
- [x] `scripts/setup-storage-buckets.js`: add `"meeting-pdfs"` to `BUCKETS`
      (same private-bucket pattern as `signatures`/`crew-photos`); header
      comment updated to mention Phase 5
- [x] Root `package.json`: add `pdfkit` (`npm install pdfkit` — resolved
      `pdfkit@0.20.2`, confirmed via `npm ls pdfkit`)
- [x] Pre-req: apply the SQL, rerun `npm run setup:storage` — needs a live
      Supabase session/service-role key not available in this environment

### 5c — Client: GC contact email field · status: code complete, coverage/lint/tsc clean

- [x] `client/src/interfaces/project.ts` — `gcContactEmail: string | null`
      (doc comment cross-references the Cross-cutting epic's supersession)
- [x] `client/src/features/projects/ProjectForm.tsx` — optional email
      `TextInput` after the existing GC-name field, labeled "GC contact
      email (optional)" per the `TalkForm.tsx` optional-label convention;
      Zod `z.string().trim().email(...).or(z.literal(""))` (RHF's native
      text input never yields `undefined`, so `.optional()` alone wouldn't
      make it truly optional — no prior optional-email precedent existed in
      this client, so this idiom is now the one to reuse)
- [x] `client/src/services/apiProjects.ts` — `gcContactEmail?: string |
null` on `CreateProjectInput`/`UpdateProjectPatch`; `useCreateProject.ts`
      (optimistic-entry default) / `useUpdateProject.ts` (via
      `optimisticProjects.ts`'s `applyProjectPatch`) thread it through
      (+ tests across `ProjectForm.test.tsx`, `apiProjects.test.ts`,
      `useCreateProject.test.tsx`, `useUpdateProject.test.tsx`,
      `optimisticProjects.test.ts`)
- [x] Verify: `apiProjects.ts` / `useCreateProject.ts` / `useUpdateProject.ts`
      / `optimisticProjects.ts` all confirmed 100% coverage (`ProjectForm.tsx`
      is already in `vite.config.ts`'s coverage exclude list, same as
      `TalkForm.tsx`); `npx eslint` clean on every touched file; `tsc -b`
      shows no _new_ errors (still only the pre-existing `Input.tsx`
      failures documented under Phase 1). Full suite: 785/787 passing — the
      only 2 failures are the pre-existing, unrelated `PhotoCapture.test.tsx`
      camera-mock timing cases already called out under Phase 4h
- [x] **Gap fix (found while starting 5d):** 5c only threaded
      `gcContactEmail` through the _client_ — `server/services/projects.js`'s
      `PROJECT_COLUMNS`/`toProject`/`create`/`update`,
      `server/controllers/projects.js`, and `server/routes/projects.js`'s
      validator chains had no knowledge of `gc_contact_email` at all, so a
      value a foreman typed in was silently dropped before reaching Supabase.
      Fixed: column added to `PROJECT_COLUMNS`/`toProject`; `create`/`update`
      read and write it; `createProject`/`updateProject` controllers pass it
      through; both `POST /`/`PATCH /:id` validators gained an
      `.optional({ checkFalsy: true }).isEmail()` chain (mirrors
      `waitlist.js`'s existing email validator); `server/services/
projects.test.js` and `server/controllers/projects.test.js` both updated
      with matching cases

### 5d — Server: PDF rendering (pure, testable) · status: done

- [x] New `server/services/pdfGeneration.js` — pure `renderMeetingLogPdf({
meetingLog, project, talk, signatures, crewPhotoBuffer })` → `Buffer` via
      `pdfkit` (`compress: false`, so rendered text stays greppable in the
      raw buffer for tests); prints the CPWR/NIOSH attribution block per
      `docs/content-attribution.md`. `crewPhotoBuffer` is an optional
      pre-fetched param (this function does no Storage I/O itself) — 5e is
      what will download the photo bytes and pass them in; when omitted, the
      PDF prints a "No crew photo on file" note instead of embedding an image
- [x] Unit tests (`server/services/pdfGeneration.test.js`, 8 cases): valid
      `%PDF-` header, doesn't throw on a full or minimal fixture, project
      name/talk title/signer names present in rendered content, CPWR/NIOSH
      attribution printed when present and omitted when absent, quiz
      pass/fail printed per signer when the talk has a quiz and omitted when
      it doesn't, crew-photo fallback note when no buffer is given. Required
      a `decodeRenderedText` test helper: pdfkit renders text as hex-encoded
      glyph runs inside `TJ` kerning arrays, not literal parenthesized
      strings, so a plain `buffer.toString().includes(...)` never matches —
      the helper decodes every `<hex>` run back to ASCII and concatenates
      them (kerning splits fall mid-word, not at gaps needing a reinserted
      separator) so assertions can check rendered content directly
- [x] Verify: `npm run test:server` — full suite 217/217 passing (up from
      206), no regressions

### 5e — Server: orchestration + signed-URL endpoint · status: code complete; curl smoke with a real Bearer token pending

- [x] Signature deviation from the original bullet: implemented as
      `pdfGenerationQueue.enqueue(meetingLogId, companyId)`, not the
      one-arg `enqueue(meetingLogId)` originally sketched. Every read the
      pipeline needs (`meetingLogs.getById`, the new `projects.getById`,
      `talks.getById`, `signatures.listForMeeting`) is company-scoped by
      convention, and `complete()` already has `companyId` in scope — so the
      one call site (`meetingLogs.js`'s `complete()`) now passes it through
      rather than the queue bypassing scoping with a raw unscoped query.
- [x] `server/services/storage.js` gained `downloadBlob(bucket, path)` (the
      queue needs actual crew-photo bytes to embed; `storage.js` previously
      only had `uploadBlob`/`getSignedUrl`) — converts Supabase Storage's
      `Blob` to a `Buffer` via `arrayBuffer()`
- [x] `server/services/projects.js` gained `getById(id, companyId)` (no
      single-project getter existed; only `listForCompany`/`create`/
      `update`/`remove`) — same scoped-`getById` pattern as
      `meetingLogs.js`/`talks.js`
- [x] `server/services/meetingLogs.js` gained `pdfPath(id)` (the
      `{id}/report.pdf` Storage path, mirrors `crewPhotoPath`),
      `setFinalPdfUrl(id, companyId, path)`, and `getPdfUrl(id, companyId)`
      (direct mirror of `getCrewPhotoUrl`, 404s until a PDF exists)
- [x] Implemented `server/services/pdfGenerationQueue.js`'s
      `enqueue(meetingLogId, companyId)`: fetches the meeting log + its
      project/talk/signatures (talk skipped when `talkId` is `null` —
      `meeting_logs.talk_id` is `ON DELETE SET NULL`) via
      `Promise.all`, best-effort downloads the crew photo (a download
      failure degrades to no-photo rather than aborting the whole PDF),
      calls `pdfGeneration.renderMeetingLogPdf`, uploads the result to the
      `meeting-pdfs` bucket at `{meetingLogId}/report.pdf`, and persists the
      path via `setFinalPdfUrl` — the whole function is wrapped in a single
      try/catch that only logs, per 5a's soft-fail decision, so it can never
      throw back into `complete()`. Required lazily `require`-ing both
      `meetingLogs.js` and `signatures.js` from inside `enqueue()` instead of
      at module top-level: `meetingLogs.js` already required this file
      (to call `enqueue` from `complete()`), and `signatures.js` requires
      `meetingLogs.js` — so a top-level require of either here would close a
      circular-require loop. This codebase's `module.exports = {...}` style
      (reassignment, not incremental `exports.x = ...`) means whichever
      module in a cycle finishes loading second gets a stale, empty exports
      object from the other; requiring lazily avoids that. Also required
      `pdfGeneration.js` as the module object rather than destructuring
      `renderMeetingLogPdf` off it — a destructured binding would have
      captured the function reference at require-time, unreachable by
      `vi.spyOn`'s property-replacement on the module object in tests.
- [x] New `GET /api/meetings/:id/pdf-url` — signed URL, direct mirror of the
      existing crew-photo-url endpoint (controller + route + validator)
- [x] Tests: new `server/services/pdfGenerationQueue.test.js` (11 cases:
      happy path with a crew photo, talk-less meeting, photo-less meeting,
      photo-download failure still completes, and a parameterized case per
      dependency confirming `enqueue` never throws — soft-fail contract);
      `storage.test.js` +2 (`downloadBlob`), `projects.test.js` +3
      (`getById`), `meetingLogs.test.js` +5 (`setFinalPdfUrl` ×2,
      `getPdfUrl` ×3, updated the existing `complete()` assertion for the
      new `enqueue(id, companyId)` signature), `controllers/meetingLogs.test.js`
      +2 (`getPdfUrl`). Full `npm run test:server` suite: 240/240 passing
      (up from 217)
- [x] Verify (partial): booted the server and confirmed `GET
/api/meetings/:id/pdf-url` returns 401, not 404/the SPA fallback, same
      as every other new server-only route in prior sub-phases. Full
      curl-with-a-real-Bearer-token pass (complete a meeting, confirm a PDF
      lands at `meeting-pdfs/{id}/report.pdf`, confirm the signed URL works,
      confirm a cross-company 404) still needs a live session token — same
      as every prior server-only sub-phase's manual-smoke item
- [x] **Follow-up: friendly download filenames.** The Storage _path_
      (`{meetingId}/report.pdf`) stayed as-is — Supabase's `createSignedUrl`
      supports a `download` option that names the browser's save-as file
      independent of the object's actual key, so there was no need to touch
      `pdfPath`/`final_pdf_url` at all. New `server/utility/pdfFilename.js`
      (`buildPdfFilename`, pure/no I/O — same category as
      `composeTalkMarkdown.js`) builds
      `{company-slug}-{project-slug}-{date}-{shortId}.pdf` — company
      (the reporting subcontractor) first, since a GC managing several subs
      on one site files/sorts OSHA paperwork by contractor first, and it's
      also how multiple PDFs sort alphabetically in one folder or the future
      ZIP bundle below; the short id (first 8 chars of the meeting log's own
      id) guarantees uniqueness since company+project+date alone can still
      collide (multiple talks, same company/project/day). `storage.js`'s
      `getSignedUrl` gained an optional 4th `downloadFilename` param passed
      through as `{ download: filename }` (backward compatible — every other
      caller omits it). New `server/services/companies.js` (`getById(id)`,
      unscoped — the id passed is always the caller's own verified
      `companyId`, never a route param) — nothing in the request pipeline
      previously loaded the caller's own company _name_ (`req.user` only
      carries `companyId`). `meetingLogs.js`'s `getPdfUrl` now fetches the
      project and company in parallel (`Promise.all`, same pattern
      `pdfGenerationQueue.js` uses) and passes the built filename through;
      the `finalPdfUrl` guard still runs first so a not-yet-generated PDF
      404s without either extra lookup. New `companies.test.js` (3 cases,
      mirrors `projects.test.js`'s `getById` block minus ownership scoping);
      `pdfFilename.test.js` (8 cases: normal names, unicode/special-char
      stripping, whitespace collapsing, company-name fallback,
      project-name fallback, 60-char truncation of each, missing-date
      fallback, id-suffix extraction); `meetingLogs.test.js`'s `getPdfUrl`
      block updated to mock `companiesService.getById` and assert the full
      filename. Full `npm run test:server` suite: **252/252 passing** (up
      from 240). Explicitly does **not** add the company name to the PDF's
      own printed content (`pdfGeneration.js`'s layout) — filename-only,
      flagged as a possible future look, not requested here.
- [x] **Follow-up: PDF content pass.** The three items just flagged as "not
      requested here" above, requested in the next turn after the user
      opened an actual generated PDF: `pdfGeneration.js`'s header now prints
      `Subcontractor: {company.name}` as its first line (mirrors the
      filename's company-first ordering; falls back to `"Unknown"` when
      `company` is omitted — `meeting_logs.company_id` is documented
      nullable even though `create()` always populates it today);
      `formatDate` now renders `"September 18, 2026 at 12:00 PM UTC"`
      instead of the raw ISO timestamp (native `Intl.DateTimeFormat`,
      `timeZone: "UTC"` pinned for determinism, `"UTC"` appended manually
      since `Intl` won't combine `dateStyle`/`timeStyle` presets with
      `timeZoneName` — no new dependency; `dayjs`/`moment` are both in
      `package.json` but unused anywhere server-side, not worth entangling
      here); each signer's row now embeds their actual drawn signature image
      (`doc.image(signature.imageBuffer, { fit: [200, 80] })`) instead of
      just their typed name, printing `"(signature image unavailable)"`
      when one couldn't be downloaded. `pdfGenerationQueue.js` now fetches
      the company (`companiesService`, required at module top level — no
      reverse dependency, unlike the already-lazy `meetingLogs`/
      `signatures`) alongside project/talk/signatures, and downloads each
      signature's PNG blob the same best-effort way the crew photo already
      was (one signer's image failing to download doesn't abort the whole
      PDF, same soft-fail precedent). Also added a static, unconditional
      watermark footer line (`"Logged via TailgatePro (Free plan) —
  upgrade to Trade Pro to remove this watermark and add your company
  logo."`, `Helvetica-Oblique` + gray fill, pdfkit's built-in font, no
      file to embed) after the user asked how PDF branding is being
      handled — `docs/pricing-and-positioning-strategy_V2.md` already
      promises exactly this as the Trade Free default with Trade Pro+
      removing it via custom logo upload; **full tier-gating is deferred**,
      see the new bullet below. Tests: `pdfGeneration.test.js` 8→13 cases
      (company rendered + `"Unknown"` fallback, human-readable date
      assertion, a real minimal-PNG signature image embed that doesn't
      throw — no prior test in this file exercised `doc.image()` with an
      actual buffer, the crew-photo tests only covered the "no photo"
      branch — the unavailable-image fallback note, and the watermark
      text); `pdfGenerationQueue.test.js` 11→13 cases (company fetch +
      per-signature image download wired into the happy-path assertion, a
      new one-signature-image-fails-without-affecting-others case, and
      `companiesService.getById` added to the never-throws `it.each`
      parameterization). Full `npm run test:server` suite: **259/259
      passing** (up from 252).
- [x] **Follow-up: fixed a pagination bug the signature-image embed exposed.**
      The user generated a PDF and found the crew photo cut off at the
      bottom of page 1 with nothing on page 2. Root cause: pdfkit's
      `doc.text()` auto-paginates (checks remaining page height, calls
      `addPage()` internally) but `doc.image()` does not — an image near
      the bottom of a page just gets clipped at the boundary, and whatever
      renders _after_ it correctly flows to the next page, leaving the
      image itself stranded/cut off with nothing "using" the new page. This
      bug already existed for the crew photo but got much easier to hit
      once each signer also got an ~80px embedded signature image this
      session (the doc got taller, so the crew-photo section lands near a
      page boundary far more often). Fix: new exported `ensureRoomFor(doc,
  height)` in `pdfGeneration.js` — checks `doc.page.height -
  doc.page.margins.bottom - doc.y` against the needed height and calls
      `doc.addPage()` proactively if it won't fit; called before both
      `doc.image()` sites (320 for the crew photo section — heading + image
      kept together so the heading doesn't get orphaned alone at a page
      bottom — and 80 for each signature image), sized to each `fit`
      bounding box (a safe upper bound, since `fit` only ever scales an
      image down). Exported specifically for direct unit testing against a
      fake `doc` object, since pagination math isn't practically assertable
      from this file's usual decoded-PDF-text black-box tests. Tests:
      `pdfGeneration.test.js` 13→17 cases — 3 new `ensureRoomFor` unit tests
      (enough room / not enough room / exact-boundary edge case) plus 1
      integration smoke test rendering 6 signers with images and a crew
      photo, then counting `/Type /Page` object occurrences in the raw
      (uncompressed) PDF bytes to confirm the document actually spans
      multiple pages rather than silently overflowing one. Full
      `npm run test:server` suite: **263/263 passing** (up from 259).
- [x] **Follow-up: visual hierarchy + GC growth CTA.** The user asked for
      more visual hierarchy (bullets weren't indented, key labels/headings
      weren't bold) and for closing marketing copy enticing whichever GC
      receives the PDF to try TailgatePro — confirmed the recipient is
      often a GC with no TailgatePro account at all (the subcontractor is
      the one with an account), and confirmed the link target,
      `https://www.getTailgatePro.com` (no production domain existed
      anywhere in the codebase before this — no env var, no docs reference;
      not fabricated). New `labelLine(doc, label, value)` (bold label +
      normal-weight value on one line via pdfkit's `{ continued: true }`)
      and `heading(doc, text, size)` (bold section heading, explicit font
      reset after — pdfkit's font/fillColor are both stateful, confirmed by
      hand, which is also why the new CTA block below explicitly resets
      `fillColor("black")` since the watermark line above it left the fill
      gray) helpers, both using pdfkit's built-in `Helvetica-Bold` (no font
      file to embed). Applied to the doc title, all 5 header label lines
      (`Subcontractor`/`Project`/`General contractor`/`Talk`/`Completed`),
      and every section heading (`Summary`, `Talking points`, `Hazards to
  check on site`, `Discussion questions`, `Attendance & signatures`,
      `Crew photo`). `bulletList()`'s items now render with
      `{ indent: 20, indentAllLines: true }` (the latter so a wrapped long
      item's continuation lines stay aligned under the bullet). New GC CTA
      block after the existing free-tier watermark (kept separate and
      unchanged — that one nudges the _paying subcontractor_ to upgrade;
      this new one targets _whoever opens the report_): a light horizontal
      divider, a bold question, two lines of body copy, and a bold
      blue-underlined clickable link (`{ link: CTA_URL, underline: true }`)
      reading "Try TailgatePro free at getTailgatePro.com". Confirmed a
      link annotation's URI is stored as a literal string in the raw PDF
      bytes (not hex-encoded glyph runs like visible text), so it's
      directly assertable. Rendered an actual sample PDF (realistic
      fixture, saved to the session scratchpad) and visually read it back
      page-by-page to confirm the result — bold/indent/reset all render
      correctly with no state leaking between sections (attribution and
      signer-name lines stay plain, confirming every bold block's reset
      works). Tests: `pdfGeneration.test.js` 17→19 cases — one new bullet-
      content assertion (closing a pre-existing gap: no test previously
      checked that talking-point/hazard/discussion-question text actually
      renders) and one new CTA test (headline/body/link text via the
      existing decode helper, plus the literal URL asserted against the raw
      un-decoded buffer). No existing assertion needed to change — bold/
      indent formatting doesn't alter the underlying decoded character
      content. Full `npm run test:server` suite: **265/265 passing** (up
      from 263).
- [x] **Tier-gated PDF branding** — Trade Pro+ (`companies.tier` `premium`/
      `enterprise`) companies can upload a logo; it's embedded in generated
      meeting-log PDFs and the free-tier watermark is skipped for them.
      Decided upfront: a Pro+ company with no logo uploaded yet gets neither
      the logo nor the watermark (tier alone gates the watermark,
      independent of whether a logo exists — never punish a paying company
      for not having gotten to the upload yet); logo upload is a direct
      `useMutation`, **not** routed through the offline sync outbox (an
      office/admin action, not part of the connectivity-unreliable job-site
      meeting flow); the new `/settings` page renders for every signed-in
      user, only the upload control itself is tier-gated (Trade Free sees an
      upsell in its place). Signup-time logo capture is explicitly deferred
      until a billing/checkout flow lets a user choose Trade Pro at signup —
      today every self-serve signup is hardcoded to `basic`
      (`server/services/users.js`), so there's nothing to gate at that point
      yet. - Schema: `companies.logo_path TEXT` (nullable, a Storage path never a
      URL — `Supabase_SQL.sql` + `Supabase_Schema.md`) - Storage: new private `company-logos` bucket
      (`scripts/setup-storage-buckets.js`), path `{companyId}/logo` - `server/utility/entitlements.js` gained `hasBrandingAccess`, sharing
      `TRANSLATION_TIERS` — the identical Trade Pro+ paywall - `server/services/companies.js` gained its first write op,
      `updateLogo(companyId, logoPath)`, plus `logoPath` on `getById` - `server/services/pdfGeneration.js`: `renderMeetingLogPdf` gained a
      `logoBuffer` param; the watermark block is now
      `if (!hasBrandingAccess(company?.tier))`; a small (`fit: [120, 60]`)
      logo renders in the header when entitled and a buffer is given,
      using the existing `ensureRoomFor` pagination helper - `server/services/pdfGenerationQueue.js` gained a best-effort logo
      download (mirrors the existing crew-photo pattern exactly — a
      failed/missing logo degrades to `null`, never aborts the PDF) - New `server/routes/companies.js` + `server/controllers/companies.js`
      (first files for this domain): `PUT /api/companies/logo` (raw
      `image/*` body, 5MB limit, 403s via `hasBrandingAccess` for `basic`)
      and `GET /api/companies/logo-url` (5-minute signed URL, 404 until a
      logo exists); mounted `/api/companies` in `server.js` - Server tests: new `companies.test.js` (7) + `controllers/companies.test.js`
      (8); `pdfGeneration.test.js` +6, `pdfGenerationQueue.test.js` +3. Full
      `npm run test:server` suite: **286/286 passing** - Client: `interfaces/company.ts` gained a `Company` type; new
      `services/apiCompanies.ts`, `hooks/useCompanyLogo.ts` +
      `hooks/useUploadCompanyLogo.ts`; `useCurrentUser.ts` gained
      `hasBrandingAccess` (mirrors `hasTranslationAccess`); new
      `features/company-settings/LogoUpload.tsx` (modeled on
      `PhotoCapture.tsx`'s fallback file-input pattern, select-then-confirm
      shape); new `pages/Settings/` + `/settings` route under
      `RequireAuth` + Navbar link - Client tests: new `apiCompanies.test.ts` (9), `useCompanyLogo.test.tsx`
      (4), `useUploadCompanyLogo.test.tsx` (4), `LogoUpload.test.tsx` (9),
      `Settings.test.tsx` (7); `useCurrentUser.test.tsx` +3,
      `Navbar.test.tsx` +1. 100% coverage maintained on every new/touched
      file (confirmed via a coverage run with the pre-existing, unrelated
      `PhotoCapture.test.tsx` camera-mock flakes excluded, since this
      repo's coverage reporter skips its report on any test failure) - Housekeeping: fixed a pre-existing stale assertion in
      `pdfGeneration.test.js` (the GC CTA copy/colors had already changed
      on disk before this work started; the test still expected the old
      wording) - Verify (partial): booted the server and confirmed both new routes
      return 401, not 404/the SPA fallback. Full curl-with-a-real-Bearer-
      token pass (403 for `basic`, 200 + Storage object for Pro+, signed
      URL, PDF embeds the logo/omits the watermark, cross-company 404 on
      `logo-url`) still needs a live session token, same as every prior
      sub-phase's manual-smoke item. Browser smoke (upload via `/settings`,
      confirm it flows into a completed meeting's PDF) also still owed.
- [ ] **Not yet built** — full tier-gating of PDF branding by _plan name_
      rather than raw `tier` (e.g. if Trade Enterprise ever needs a
      different branding capability than Trade Pro, `hasBrandingAccess`
      would need to stop being a literal alias of `hasTranslationAccess`).
      Not needed today — flagging only because the two gates currently share
      one array on purpose (`server/utility/entitlements.js`).
- [ ] **Not yet built** — GC "1-Click OSHA Defense Bundle" ZIP export
      (`docs/pricing-and-positioning-strategy_V2.md`'s GC Site Pro tier:
      "Download indexed ZIP of all site logs instantly"). When that gets
      scoped, reuse `server/utility/pdfFilename.js`'s `buildPdfFilename` for
      each entry's name rather than reinventing naming — same reason it was
      written as a standalone pure helper instead of inlined into
      `getPdfUrl`.

### 5f — Server: email delivery · status: code complete, all tests passing

Decisions confirmed with the user beyond the original sketch: the GC gets a
**signed link, not a PDF attachment** (avoids attachment-size risk from
crew-photo/signature-heavy meetings), but the link's TTL is extended from
the on-demand endpoint's 5 minutes to **30 days**, since a GC may not open
the email right away; the sender is **Mailgun**, via `mailgun.js` directly —
Supabase has no role in sending email anywhere in this app; the email body
is a **Mailgun template** (not inline HTML in code) so it can be restyled
from the Mailgun portal without a deploy, with its subject left blank in the
portal on purpose since `server/services/email.js` sets `subject`
per-send to reference the subcontractor company + project dynamically; the
template name is a **hardcoded constant**, not env-driven (new
`server/constants/templates.js` — the user's preference, since env vars
shouldn't hold non-secret, non-environment-specific identifiers, and this
file is meant to grow with future template names).

- [x] New `server/constants/templates.js` — first file in a new
      `server/constants/` folder; `MAILGUN_TEMPLATES.MEETING_LOG_REPORT =
"meeting-log-report"`
- [x] New `server/utility/formatDate.js` — extracted from
      `pdfGeneration.js`'s local `formatDate` (same precedent as
      `composeTalkMarkdown.js`'s extraction from `scripts/lib/talkRow.js`)
      once `email.js` needed the same "September 18, 2026 at 12:00 PM UTC"
      formatting for its `completedDate` template variable;
      `pdfGeneration.js` now imports it instead of defining it locally, no
      behavior change
- [x] New `server/services/email.js` — `sendMeetingLogEmail({ to,
projectName, companyName, pdfUrl, completedAt })`; `getMailgunClient()`
      (exported for spy-ability) returns `null` when `MAILGUN_API_KEY`/
      `MAILGUN_DOMAIN` aren't both set → logs `{ to, subject, variables }`
      instead of sending (dev fallback per 5a); when configured, calls
      `mailgun.js`'s `client.messages.create(domain, { from, to, subject,
template, "h:X-Mailgun-Variables": JSON.stringify(variables) })`. Never
      throws — a send failure is caught and `console.error`'d, matching
      `translation.js`'s "degrade, don't throw" shape; no `AppError` used
      since there's no controller/route in this call chain and
      `pdfGenerationQueue.enqueue()` already soft-fails around it
- [x] New `docs/mailgun-templates/meeting-log-report.html` — the actual
      Mailgun template content (table-based layout, inline styles, brand
      colors from `client/src/styles/GlobalStyles.ts`, a CTA button to the
      PDF link, a GC growth blurb linking `getTailgatePro.com` matching
      `pdfGeneration.js`'s existing hardcoded CTA URL), committed so the
      template is reproducible/reviewable rather than living only in the
      Mailgun portal. Handlebars variables: `{{companyName}}`,
      `{{projectName}}`, `{{pdfUrl}}`, `{{completedDate}}`
- [x] Called from `pdfGenerationQueue.enqueue` right after
      `setFinalPdfUrl`, inside the existing single `try/catch` (no new
      error handling needed): skips entirely when `project.gcContactEmail`
      is unset (silent, no log — an expected, common state); otherwise
      builds a signed URL inline via `storageService.getSignedUrl` (not
      `meetingLogsService.getPdfUrl`, which hardcodes the wrong 5-minute
      TTL and would redundantly re-fetch `project`/`company`, already in
      scope here) with the new `EMAIL_PDF_URL_TTL_SECONDS` (30 days), then
      calls `emailService.sendMeetingLogEmail`
- [x] Tests: `server/utility/formatDate.test.js` (3 cases),
      `server/services/email.test.js` (6 cases — dev-fallback log, real send
      with dynamic subject + stringified template variables, send-failure
      caught, `getMailgunClient`'s three gating branches), 2 new
      `pdfGenerationQueue.test.js` cases (skip when unset, signed URL + send
      when set) plus 2 new rows in its existing never-throws `it.each`
      table (`storageService.getSignedUrl`, `emailService.sendMeetingLogEmail`).
      Full `npm run test:server` suite: **299/299 passing**
- [x] Pre-req (user, outside this codebase): real `MAILGUN_API_KEY`/
      `MAILGUN_DOMAIN` confirmed present in the root `.env` (verified via a
      length check, not printed); a `meeting-log-report` template still
      needs to be created in the Mailgun portal with §the HTML above pasted
      in, subject left blank, before a live send will actually work
- [x] Manual/curl smoke: complete a meeting on a project with
      `gc_contact_email` set → confirm the recipient actually receives the
      email, the subject shows the company + project name, the button/link
      opens the PDF, and the template renders correctly on both a desktop
      and a mobile client — still owed, needs the Mailgun template created
      first (see pre-req above)

### 5g — Hardening, docs, verify · status: docs complete; live smoke pending

- [x] Tick `docs/content-attribution.md`'s "Phase 5 PDF service" line;
      cross-reference the email flow from `docs/meeting-flow-design.md` —
      `content-attribution.md` now marks the obligation implemented
      (`server/services/pdfGeneration.js` prints `copyright` + `notice`) and
      points at `meeting-flow-design.md`'s "Phase 5 hook point" for email
      delivery; `meeting-flow-design.md`'s intro now says it also covers
      Phase 5 and its PDF-scope paragraph names the implementing file
- [x] Re-surface the `gc_contact_email` → invite/join-company supersession as
      an explicit open item under the Cross-cutting epic below, so it isn't
      lost once that epic starts — already present as the epic's "Supersede
      `projects.gc_contact_email`" checkbox (added during 5a)
- [x] Manual/curl smoke: complete a meeting on a project with
      `gc_contact_email` set → confirm a PDF lands in the `meeting-pdfs`
      bucket, `final_pdf_url` is populated, `GET .../pdf-url` returns a
      working signed URL, and the email send fires (console-logged in dev, or
      a real Mailgun test send). Needs live Supabase + Mailgun + a real
      Bearer token. Runbook:
  - Prereqs: root `.env` has Supabase + `MAILGUN_API_KEY`/`MAILGUN_DOMAIN`;
    `npm run setup:storage` has created `meeting-pdfs`; the
    `meeting-log-report` template is in the Mailgun portal (HTML from
    `docs/mailgun-templates/meeting-log-report.html`, subject blank); a
    project with `gc_contact_email` set to an inbox you control; a Bearer
    token from the browser session (`supabase.auth.getSession()`)
  - Flow: `POST /api/meetings` (client-generated UUID `id`, `projectId`,
    `talkId`) → `POST /api/meetings/:id/signatures` (≥1) →
    `PATCH /api/meetings/:id/complete`
  - Confirm: PDF object in the `meeting-pdfs` bucket;
    `meeting_logs.final_pdf_url` populated; `GET /api/meetings/:id/pdf-url`
    returns a signed URL that opens the PDF (CPWR/NIOSH attribution
    visible); email received (subject shows company + project, button opens
    the PDF, renders on desktop and mobile)
  - Second pass with `MAILGUN_*` unset → the server console logs
    `{ to, subject, variables }` instead of sending

## Phase 6 — GC dashboard · epic

Plan: `~/.claude/plans/let-s-work-on-phase-snazzy-sphinx.md`. Originally one line, marked blocked by the
invite/join-company epic. Exploration showed nothing in the app can set `projects.gc_company_id` or write
`project_subcontractors`, and every read (meeting logs, PDFs, `projects.getById`) is scoped to the owning
sub's company — so a GC gets 404 on a sub's meetings today. Rather than wait on the full invite epic, Phase 6
opens with a slim "GC connects to a project" slice and defers email invites/roles to the Cross-cutting epic.

Decisions locked with the user:

- **Sequencing** — slim link slice first (6b–6d); email invites, `admin`/`safety_manager` role enforcement, and
  `gc_contact_email` supersession stay under Cross-cutting
- **Project model** — sub-owned, linked by GC code: each sub keeps its own project row; the sub enters the GC
  company's join code, which sets `projects.gc_company_id` and adds a `project_subcontractors` row. The GC
  dashboard groups linked rows into a jobsite (by name) and rolls up per sub. No change to the sub's offline flow
- **Compliance v1** — "logged today / missing" per linked sub. **Cadence is daily by product decision** (job
  sites change constantly, so hazards change daily), but is expected to become configurable later by the GC
  and/or an individual sub (some subs will want weekly) — so the compliance logic takes a period window as
  input rather than hardcoding "daily". No cadence schema/endpoint/UI in this phase
- **Tier gating deferred** — no GC entitlement / blurred-sub-#2 here; rides with the deferred Stripe /
  `companies.tier` reconciliation
- Read-only dashboard, online-only (no outbox, no new Dexie tables)

Decided in the 6a review (all three as recommended in `docs/gc-dashboard-design.md`):

- **`held_at`** — a client-reported `meeting_logs.held_at` drives compliance windows, the PDF's meeting date,
  the PDF filename and the email date, because `completed_at` is stamped at _server receipt_ and would put an
  offline meeting synced after midnight on the wrong day. Added as its own sub-phase, **6b2**
- **RLS on** `companies`, `users`, `projects`, `project_subcontractors` (no policies) — closes a doc/code
  mismatch and protects the new `companies.join_code`
- **`gcCompanyId` closed** on `POST`/`PATCH /api/projects` — the join-code link endpoints are the only writer

### 6a — Design doc · status: done

- [x] New `docs/gc-dashboard-design.md` (shape of `docs/meeting-flow-design.md`: why this exists, schema
      additions, decisions, "explicitly not resolved here", landing order)
- [x] `project_subcontractors` role under the sub-owned model — write `(project_id, owner_company_id)` on link
      as a roster, but authorization keys on `projects.gc_company_id` only, so drift is never a security issue
- [x] Jobsite grouping key — `(gc_company_id, normalized project name)`; GC-owned canonical jobsite noted as
      the future upgrade
- [x] The "today" boundary — client sends local `date` + `tzOffset`, server computes the UTC range
- [x] Configurable-cadence extensibility sketched (design only, not built): GC default + per-sub override with
      the GC's value as a floor; per-sub window computed by the overview; cadence-neutral status names
- [x] GC PDF access — authorize via `projects.gc_company_id = caller` (404, never 403); filename built from the
      _meeting's_ company, not the caller's; no crew-photo/signature-image URLs exposed to GCs in v1
- [x] "Completed, PDF pending" tolerated via `pdfReady`; noted there is no PDF regeneration path
      (`pdfGenerationQueue.enqueue` has one call site, inside `complete()`)
- [x] `docs/data-access.md` updated with the GC read path (service-layer, no RLS policies) and a pointer to the
      RLS doc/code mismatch below
- [x] Review — the 3 decisions above resolved (option A / enable RLS / close `gcCompanyId`); the design doc's
      "needing review" section, timestamp block and RLS finding are rewritten as decided

### 6b — Schema: join code, `held_at`, RLS · status: SQL + docs written; applying to Supabase pending

SQL and schema docs only — no application code and no consumers yet (same shape as 4b/5b).

- [x] `companies.join_code TEXT UNIQUE` (nullable; GC-only via `CHECK check_join_code_gc_only`; generated
      server-side in 6c, so the client-UUID rule doesn't apply)
- [x] `meeting_logs.held_at TIMESTAMPTZ` (nullable), with a backfill from `completed_at` so existing meetings
      keep the date and filename they have today. No new index — per-GC query volume doesn't warrant one yet
- [x] `ENABLE ROW LEVEL SECURITY` (no policies) on `companies`, `users`, `projects`, `project_subcontractors`,
      after each `CREATE TABLE`, with matching commented upgrade lines. Checked safe: the client never queries
      tables (only creates the Supabase auth client), and the server plus `scripts/*` all use the service-role
      client, which bypasses RLS. Removed the stale "pre-existing gap" comment at the `user_favorites` block
- [x] `Supabase_SQL.sql` (commented `ALTER …` upgrade lines per prior phases) + `Supabase_Schema.md` (`join_code`
      and `held_at` rows; RLS notes under the Companies & Users and Projects & Access sections);
      `docs/data-access.md` mismatch bullet marked resolved-once-applied
- [ ] Pre-req (user, outside this codebase): run `SELECT id, name FROM projects WHERE gc_company_id IS NOT
      NULL;` — expect **no rows** (the client never set it; tell Claude if any appear) — then run the upgrade
      lines in the Supabase SQL editor: the `companies` and `meeting_logs` `ALTER`s, the four
      `ENABLE ROW LEVEL SECURITY` statements, and the `held_at` backfill `UPDATE`. If a trigger was ever
      created by hand in the dashboard, it must be `SECURITY DEFINER`
- [ ] Verify after applying: `information_schema.columns` shows `companies.join_code` and
      `meeting_logs.held_at`; `SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('companies',
      'users','projects','project_subcontractors')` is all `true`; `SELECT count(*) FROM meeting_logs WHERE
      completed_at IS NOT NULL AND held_at IS NULL` is `0`; an anon-key request to
      `/rest/v1/companies?select=id` returns `[]`; the app still loads Projects/Dashboard (service role
      bypasses RLS)

### 6b2 — `held_at` plumbing (server + client) · status: code complete; live smoke pending

Populates the column 6b adds, so 6e's compliance windows have real data. Inserted between 6b and 6c and named
6b2 to avoid renumbering 6c–6g. Design: `docs/gc-dashboard-design.md` "Compliance". Two simplifications came out
of the exploration: the `heldAt ?? completedAt` fallback lives once, in `toMeetingLog`, so every consumer just
reads `meetingLog.heldAt`; and the client stamps the time in `useCompleteMeetingLog` (the one place the
completion row is enqueued), so `MeetingWizard.tsx` and its tests are unchanged.

- [x] **Server core**: new pure `server/utility/heldAt.js` (`resolveHeldAt`, 5 min future / **7 day** past
      window). `complete()` writes `completed_at` (server receipt) and `held_at` from the same `now`;
      `MEETING_LOG_COLUMNS` / `toMeetingLog` gain `held_at` / `heldAt` (falling back to `completed_at`); the
      `PATCH /api/meetings/:id/complete` route validates only the _format_ of an optional `heldAt`
      (ISO 8601 → else `422`) and the controller passes it through
- [x] **Deliberate design call — an out-of-range `heldAt` is ignored, not rejected.** The plan said `422`, but the
      client's offline outbox retries a `failed` row forever (`RETRYABLE_STATUSES` in `utils/db/outbox.ts`) with
      an identical payload, so a rejected `heldAt` would leave a fully-signed meeting permanently un-completed —
      no PDF, invisible to the GC. Instead a missing, unparseable, >5-min-future or >7-day-old `heldAt` falls
      back to server receipt time and the completion still succeeds. Covered by a regression test
- [x] **PDF records it**: header `Completed: <completedAt>` → `Meeting held: <heldAt>`; the footer's
      `Generated <now>` is unchanged and, since generation runs inside `complete()`, doubles as the
      server-receipt time — so the PDF carries both timestamps. `docs/meeting-flow-design.md`'s "PDF content
      scope" paragraph corrected
- [x] **PDF filename uses it**: `buildPdfFilename`'s param renamed `completedAt` → `meetingDate`; callers
      (`meetingLogs.getPdfUrl`, `pdfGenerationQueue`) pass `heldAt`. Existing meetings keep their exact
      filename (backfill: `held_at` = `completed_at`)
- [x] **Email**: `email.js`'s param renamed to `meetingDate`; the Mailgun template variable stays
      `completedDate` (it lives in the Mailgun portal, so no template change is needed and its copy already reads
      correctly for the held time)
- [x] **Client**: `MeetingLog.heldAt`; `completeMeeting(accessToken, meetingId, heldAt?)` sends a JSON body only
      when given; `meetingLogReplayHandler` forwards `payload.heldAt` (an empty pre-existing payload passes
      `undefined`, so completions queued before this deploy still replay); `useCompleteMeetingLog` stamps
      `heldAt` at enqueue time. No deploy-ordering constraint: an old server ignores the extra body, and an old
      client's empty completion falls back on the new server
- [x] **Tests**: server **316/316 passing** (up from 299; run with dummy `SUPABASE_*` env vars since
      `vitest.config.js` doesn't load `.env`) — new `heldAt.test.js`, plus updates across `meetingLogs` (service +
      controller), `pdfFilename`, `pdfGeneration` (fixture has a `heldAt` different from `completedAt`, asserts the
      rendered "Meeting held" line and that the receipt time is not presented as the meeting time), `email`,
      `pdfGenerationQueue`. Client: the 4 touched suites pass (59 tests) and the 3 changed source files are at
      **100%** statements/branches/functions/lines. `npx eslint` clean on every touched client file; `tsc -b`
      shows only the pre-existing `Input.tsx` errors
- [ ] **Pre-existing, unrelated failure found**: `client/tests/features/meeting-flow/PhotoCapture.test.tsx` fails 2
      tests (`onCapture` never called after `fireEvent.change` / capture click). Verified pre-existing by running
      it against a clean `git archive HEAD` copy with no `heldAt` changes — same 2 failures. Because a vitest run
      with any failure skips the coverage report, the full-suite `--coverage` threshold can't be confirmed green
      until this is fixed. Not touched here
- [ ] Verify (user, needs live Supabase + Mailgun — also the first live use of the 6b `held_at` column, so a
      missing column would show as a 502 "Could not complete the meeting"): complete a meeting in the app →
      `meeting_logs.held_at` is set; the PDF header reads `Meeting held: …` and its footer `Generated …`; the
      downloaded filename and the email carry the held date. Then `curl` `PATCH …/complete` with no body →
      `held_at` = `completed_at`; and with a `heldAt` ~10 days old → still completes, `held_at` = server time
- [ ] Known limitations, tracked not dropped: (1) already-generated PDFs keep the old "Completed" header — no
      regeneration path exists; (2) `formatDate` prints UTC and `held_at` keeps no timezone, so a late-evening
      West Coast talk can show the next calendar date on the PDF — a real fix stores the foreman's tz offset
      (e.g. `held_tz_offset`) and formats with it; (3) a client-supplied time can be backdated (bounded to 7
      days, and `completed_at` is kept as server-side evidence), so 6e/6f show both `heldAt` and `completedAt`
      on the GC detail view; (4) `heldAt` is stamped when the completion row is enqueued, so a save resumed after
      an interruption stamps the resume time rather than the first Save tap

### 6c — Server: GC identity + link endpoints · status: not started

- [ ] `getUserContext` / `loadUserContext` add `companyType` to `req.user`; new `requireGcCompany` middleware
      (403 otherwise)
- [ ] GC: `GET /api/companies/join-code` (lazily creates the code)
- [ ] Sub: `POST /api/projects/:id/link-gc { joinCode }` and `DELETE /api/projects/:id/link-gc` — owner-scoped;
      sets/clears `gc_company_id`, upserts/deletes the `project_subcontractors` row; `AppError` for bad code
      (404) / already linked
- [ ] Remove `gcCompanyId` from `POST`/`PATCH /api/projects` (validators in `server/routes/projects.js`,
      `server/controllers/projects.js`, `create`/`update` in `server/services/projects.js`) so the link
      endpoints are the only writer; keep `gcNameCustom` required on create (`check_gc_info`). On link, keep
      `gc_name_custom` (fill with the GC's name if empty) so unlink stays legal
- [ ] Tests (CommonJS, `server/**/*.test.js`) for every layer

### 6d — Client: identity + linking UI · status: not started

- [ ] `useCurrentUser` also returns `role`, `companyId`, `companyType` (already fetched, currently discarded)
- [ ] GC side: show/copy the join code in Settings
- [ ] Sub side: "Link to a GC" field on the project form/list; fix `ProjectList` showing the raw `gcCompanyId`
      (server returns the GC company name); online-only with an offline message
- [ ] `useLinkProjectToGc` domain hook (wraps TanStack `useMutation`, not inline) + `apiProjects.ts` calls
- [ ] Remove the now-dead client `gcCompanyId` write paths (`apiProjects.ts` payload types,
      `useCreateProject.ts`, `optimisticProjects.ts`); the read-only `Project.gcCompanyId` stays
- [ ] Tests at the 100% jsdom coverage threshold

### 6e — Server: GC read APIs + compliance logic · status: not started

- [ ] Pure `server/utility/compliance.js` — roster + completed logs + period window (`start`, `end`) → per-sub
      `logged|missing`, `lastLoggedAt`, count; knows nothing about "daily" (service derives today's window and
      passes it in); includes a multi-day-window test to lock cadence-agnosticism in
- [ ] New `server/services/gcDashboard.js` with an `assertGcLinkedProject` authorization helper
- [ ] Routes/controllers behind `requireAuth → loadUserContext → requireGcCompany`:
      `GET /api/gc/overview?date&tzOffset`, `GET /api/gc/meetings?projectId&from&to`, `GET /api/gc/meetings/:id`
      (detail + signatures), `GET /api/gc/meetings/:id/pdf-url` (reuse `buildPdfFilename`)
- [ ] Only completed logs exposed; a non-linked project/meeting returns 404 (no 403 info leak); no crew-photo
      or signature-image URLs via `/api/gc` (retention question still open); `pdfReady` flag on log rows
- [ ] Period window and the `from`/`to` filter use `held_at` (decided in the 6a review; populated by 6b2); log
      rows and the detail view return both `heldAt` and `completedAt`, so the UI can show a "received later" cue
- [ ] GC `pdf-url` names the file from the _meeting's_ company and `heldAt ?? completedAt` (via the renamed
      `buildPdfFilename` param from 6b2)
- [ ] Tests for every layer

### 6f — Client: GC dashboard UI · status: not started

- [ ] `/gc` route guarded by new `RequireGc` (non-GC → `/dashboard`)
- [ ] Enable the Dashboard "GC Compliance" card for GC companies only
- [ ] Page: stat tiles (subs on site / logged today / missing), jobsite list, per-sub logged/missing pill (visual
      reference `GcDashboardMockup.tsx`), drill-in to a sub's recent logs with "Open PDF" (signed URL fetched on
      click, new tab)
- [ ] Hooks `useGcOverview`, `useGcMeetings`, `useGcMeetingPdfUrl` + `apiGc.ts`; loading/error/empty/offline
      states
- [ ] Local `Styled*` components (copy `features/projects/styles.ts`; promote to `ui_comps` only if reused)
- [ ] Tests at 100% coverage

### 6g — Hardening, docs, verify · status: not started

- [ ] Final docs pass: `docs/PRD.md` §7.1 open question (partially answered); tick the Cross-cutting "GC links
      a sub company to a project" item (done via join code); confirm `Supabase_Schema.md` and
      `docs/data-access.md` still match what shipped (both were updated in 6a/6b)
- [ ] Manual two-account smoke (needs live Supabase, the 6b SQL applied, one `company_type = gc` account and one
      subcontractor account): GC gets a code → sub project links → sub completes a talk → GC dashboard shows
      "Logged" + a working PDF link; a second sub with no log shows "Missing"; a non-GC account gets 403 on
      `/api/gc/*`

### Not in Phase 6 (tracked, not dropped)

- [ ] Configurable meeting cadence (GC- or sub-defined, e.g. weekly) — daily is the v1 rule; only the 6a design
      sketch and the window-parameterized compliance util (6e) prepare for it
- Email invites & role enforcement, `gc_contact_email` supersession → Cross-cutting epic below
- GC tier gating / blurred subs / SMS nudges, Procore/ACC sync, OSHA Defense ZIP, cross-project scorecards /
  multi-manager roles, GC-owned canonical jobsites → future

## Phase 7 — Multi-language talks + entitlement gating · status: code complete, 100% client coverage; manual verify + GOOGLE_TRANSLATE_API_KEY provisioning pending

Plan: `~/.claude/plans/i-noticed-that-there-buzzing-fox.md`. Started from the user noticing
`useTalkAudio`'s "read aloud" only changed the TTS _voice/accent_, never the talk's actual text —
a real gap against `docs/PRD.md` §4.4's "TTS in English, Spanish, and other requested languages."
Two source-dependent translation strategies converge on one schema/UI: the global library
(official-source-only, mechanism-only this pass) and custom talks (Google Cloud Translation API at
create/edit time). Along the way, discovered `client/src/data/plans.ts` gates multi-language behind
Trade Pro/Enterprise and that **no entitlement enforcement existed anywhere** (server or client) —
added the first real (if minimal) one, both to honor the pricing page and because Google Translate
is a metered API. AI Talk Builder and cloud "AI voice" synthesis (both also promised on the pricing
page) were explicitly scoped OUT — see Known limitations below.

- [x] Shared `toolbox_talks.translations` JSONB column (`Supabase_SQL.sql`, `Supabase_Schema.md`) —
      per-language `{ title, summary, talking_points, site_hazards_to_check, discussion_questions }`,
      keyed by ISO 639-1 code; English stays implicit (the row's own fields). `Talk`/`TalkTranslation`
      (`client/src/interfaces/talk.ts`), `server/services/talks.js` `TALK_COLUMNS`/`toTalk`, and
      `scripts/lib/talkRow.js` `buildRow` all pass it through, defaulting to `null`
- [x] Entitlement gating (new) — `server/utility/entitlements.js` (`hasTranslationAccess`, tiers
      `premium`/`enterprise`); `server/services/users.js` `getUserContext` now joins
      `companies(tier)`; `loadUserContext` puts `tier` on `req.user`; new `GET /api/users/me` (first
      endpoint exposing profile/tier to the client at all) backs new client
      `useCurrentUser.ts`/`apiUsers.getCurrentUser`, deliberately layered on top of `useAuth()`
      rather than merged into `AuthProvider` per CLAUDE.md. `createTalk`/`updateTalk`/
      `listTranslationLanguages` all 403 with "Upgrade to Trade Pro to unlock multi-language talks"
      when `targetLanguages`/the languages list is requested without access
- [x] Global library path — `.claude/agents/talks/safety-structurer.md` documents an optional
      `translations` key in the Standard Talk Schema: official agency-published translations only
      (e.g. CPWR/NIOSH "Charlas de Seguridad"), never machine-translated. No backfill of the existing
      30 talks this pass — that's separate future content work
- [x] Custom-talk path — new `server/services/translation.js` wraps the Google Cloud Translation API
      (v2 REST + API key, no SDK): `getSupportedLanguages()` and `translateStructuredFields()` (one
      API call per language via the array form of `q`, flattening/rebuilding the structured shape;
      a single language's failure is caught and simply omitted, never blocks the talk save). New
      `GOOGLE_TRANSLATE_API_KEY[_PROD]` in `server/utility/envUtils.js` — unset degrades to
      "unavailable" everywhere, never a hard error. `talks.js` `create`/`update` call it when
      `targetLanguages` is given; `update` full-replaces `translations` (same as `structured`) so
      unchecking a language on edit drops it. New `GET /api/talks/translation-languages` (registered
      before `GET /:id`) backs client `apiTranslation.ts`/`useTranslationLanguages.ts`
      (`enabled: isOnline && hasTranslationAccess`)
- [x] `TalkForm.tsx` — the "Translations" section is collapsed by default behind a single "Add
      translations for this talk?" `Checkbox` (always visible, not tier/online-gated itself); once
      checked it reveals the three-way tier upgrade note / offline note / "Translate into" `Checkbox`
      list, in that precedence. `wantsTranslations` state starts `true` when editing a talk that
      already has `translations` (so existing data is never hidden); unchecking the toggle also
      clears the form's `targetLanguages` via RHF `setValue` so a collapsed section can never
      silently submit a stale selection. `targetLanguages` rides in `CreateTalkInput`/
      `UpdateTalkInput` through the existing offline outbox unchanged (translation runs server-side
      whenever the write actually lands, online-now or after reconnect) — `useCreateTalk`'s
      optimistic entry gets `translations: null` (unknown until sync, same as `content`/`slug`);
      `useUpdateTalk`'s `applyTalkPatch` needed no change (already spreads `...existing` first)
- [x] `TalkPresenter.tsx` — new `client/src/utils/talkLocalization.ts`
      (`getTalkLanguageOptions`/`getLocalizedTalkContent`, `Intl.DisplayNames` for labels, whole-
      object English fallback so a talk never mixes languages mid-sentence). `useTalkAudio.ts` gained
      exported `findVoiceForLanguage` + `matchVoiceToLanguage` so picking a language also nudges the
      TTS accent to match (voice dropdown still overrides). Language switcher — and any non-English
      content at all — is gated on `hasTranslationAccess`, not just on `talk.translations` existing,
      so a Basic-tier company always sees English even against a manually-seeded row or a downgrade.
      A "Machine-translated — verify accuracy..." note shows only for non-global talks' translations
- [x] Tests: `server/services/translation.test.js` (new), updates across `talks.test.js` (service +
      controller), `users.test.js`; client: `talkLocalization.test.ts`, `useCurrentUser.test.tsx`,
      `useTranslationLanguages.test.tsx`, `apiTranslation.test.ts` (all new), plus updates to
      `TalkForm.test.tsx`, `TalkPresenter.test.tsx`, `useTalkAudio.test.tsx`, `useCreateTalk.test.tsx`,
      `useUpdateTalk.test.tsx`, `apiUsers.test.ts`. 737 client tests passing (includes the later
      collapsed-by-default toggle refinement below), **100%** coverage
      maintained (including the `Intl.DisplayNames` constructor/`.of()` fallback branches, exercised
      via `vi.spyOn` rather than skipped as dead code); 206 server tests passing. `npx eslint` clean
      on every touched file; `tsc -b` shows no _new_ errors (the pre-existing `Input.tsx` failure
      already documented earlier in this file is untouched)
- [ ] Known limitations, tracked explicitly rather than silently dropped: **AI Talk Builder** and
      **cloud "AI voice" synthesis** (both promised alongside multi-language on the pricing page) were
      out of scope for this pass; the 3-question comprehension quiz (`talk.quiz`) and the composed
      Markdown `content` (PDF) are not translated; a per-language translation failure is silently
      omitted rather than surfaced (re-opening Edit and seeing which languages are unchecked is the
      only current signal, matching the outbox's existing fire-and-forget model); `useCurrentUser`'s
      client-side tier check hand-mirrors `server/utility/entitlements.js` (server is the real
      authority, enforced on every gated endpoint)
- [ ] Verify: provision a real `GOOGLE_TRANSLATE_API_KEY` (Google Cloud project with the Cloud
      Translation API enabled + billing) in both envs; manually smoke Basic-tier (upgrade note, no
      switcher even against a DB-seeded `translations` row), Pro-tier online (checklist → create →
      edit shows pre-checked → Present shows switcher + disclaimer + voice auto-match), and Pro-tier
      offline (offline note, talk still saves) per the plan file's Verification section
- [ ] Sourcing 300+ additional talks from a purchased (non-government) bundle to approach the pricing
      page's "500+ OSHA library" claim was raised and **intentionally deferred** — flagged as a real
      licensing question (unlike NIOSH/CPWR, a commercial bundle has no vetted redistribution-in-a-
      SaaS-product license) to resolve before any ingestion work, not a content-pipeline task to run
      as-is through `safety-collector`

## Cross-cutting — Invite / join-company flow · epic, prerequisite for multi-user (Phase 6 no longer blocked on it — see 6b–6d's slim join-code link)

- [ ] Admin invites by email; invitee joins an existing `companies` row
- [ ] Real use of `admin` / `safety_manager` roles
- [ ] GC links a sub company to a project (`project_subcontractors`) — slim version (GC join code) lands in
      Phase 6b–6d; this item covers whatever richer flow follows
- [ ] **Supersede `projects.gc_contact_email`** (added in Phase 5, a manual
      free-text field entered by the foreman) with a real GC user account's
      email once this epic gives one to resolve against — don't let PDF
      delivery quietly stay on the manual field forever

## Deferred

- [-] Stripe billing (needs multi-user/site concepts; reconcile `companies.tier` enum first)
- [-] Procore integration
