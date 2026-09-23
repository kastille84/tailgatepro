# GC Dashboard Design (Phase 6)

Status: **decided** (Phase 6a design spike, reviewed; see `docs/tasks.md`). Covers how a GC
company connects to subcontractor projects, how a GC is authorized to read a sub's meeting logs, how
per-sub compliance is computed, and the endpoint contract 6c/6e implement. Full plan and sequencing:
`~/.claude/plans/let-s-work-on-phase-snazzy-sphinx.md`.

## Why this doc exists

`docs/PRD.md` §4.5 says a completed meeting's PDF is "routed to the GC's safety dashboard." Phase 5 built
the PDF and an email to `projects.gc_contact_email`, but no GC dashboard exists, and the data model can't
support one yet:

- **Nothing can link a GC.** No code path sets `projects.gc_company_id` from a real GC account, and
  `project_subcontractors` is unused (its only reference is a comment in `server/services/projects.js`).
- **Every read is owner-scoped.** `meeting_logs.company_id` is the *sub's* company (denormalized from
  `projects.owner_company_id`, see `docs/meeting-flow-design.md`). `meetingLogs.getById`/`getPdfUrl` and
  `projects.getById` all filter on it, so a GC gets a 404 on a sub's meeting or PDF today.
  `projects.listForCompany` is the one exception (`owner_company_id = me OR gc_company_id = me`).
- **`req.user` has no company type.** `{ id, companyId, role, tier }` — a GC-only guard can't be written yet.

`docs/data-access.md` already anticipated this exact feature ("A GC may read a subcontractor's meeting
logs for a shared project" as service-layer code), so this doc follows the same server-brokered,
no-RLS-policies model rather than revisiting it.

## Decisions made in review

Three items went beyond what the Phase 6 plan first approved; all three were resolved as recommended:

1. **Which timestamp decides "logged today" → add `meeting_logs.held_at`** (option A) — see "Compliance".
   `completed_at` is stamped at *server receipt*, not when the foreman actually finished the talk, so an
   offline meeting that syncs after midnight would land on the wrong day. The column lands in 6b; populating
   it (server, PDF, filename, email, wizard) is its own sub-phase, **6b2**.
2. **Enable RLS (no policies) on `companies`, `users`, `projects`, `project_subcontractors`** in 6b — see
   "RLS finding". `Supabase_SQL.sql` never enabled it, contradicting `docs/data-access.md`.
3. **Close `gcCompanyId` on project create/PATCH** — see "Only the link flow writes `gc_company_id`". The
   join-code link endpoint becomes the sole writer (6c/6d). A behavior change to two shipped endpoints.

## Decisions

### Project model: sub-owned, linked by a GC join code

Each sub keeps owning its own project row (`owner_company_id` = the sub). To connect to a GC, the sub
enters the GC company's **join code**, which sets `projects.gc_company_id` and adds a
`project_subcontractors` row. The GC dashboard groups linked rows into a jobsite and rolls up per sub. The
sub's project picker, offline cache and outbox are unchanged.

The alternative — a GC-owned canonical jobsite that subs join — matches `project_subcontractors`' intent
and gives cleaner rollups, but needs `owner_company_id` relaxed, a GC-side project create, and rework of
the sub's project picker and offline cache. Deferred; see "Explicitly not resolved here."

### Only the link flow writes `gc_company_id`

`POST /api/projects` and `PATCH /api/projects/:id` currently accept `gcCompanyId` from the request body
(`server/routes/projects.js` validators, `server/controllers/projects.js`,
`server/services/projects.js` `create`/`update`) and check only that it's a UUID. Harmless while nothing
read it. Once a GC is authorized by `projects.gc_company_id = caller`, an unchecked writer becomes a
spoofing hole: a sub could inject itself into any company's dashboard.

- 6c removes `gcCompanyId` from the create/PATCH validators, controller destructuring and service
  patch, so the request can't set it. `link-gc` / `unlink-gc` (below) become the only writers.
- 6d removes the now-dead client references (`apiProjects.ts` payload types, `useCreateProject.ts`,
  `optimisticProjects.ts`).
- Create still requires `gcNameCustom` (the `check_gc_info` constraint is unchanged), which is what the
  project form already collects.
- Existing data: the client never exposed `gcCompanyId`, so every row should be `NULL`. 6b's pre-req
  includes a one-line `SELECT` to confirm before GC reads go live.

### Join code

- New `companies.join_code TEXT UNIQUE`, nullable, meaningful only for `company_type = 'gc'`.
- 8 characters from an unambiguous uppercase alphabet (no `0/O/1/I/L`), so it survives being read aloud
  or typed with gloves on; ~10^12 combinations. Input is trimmed and uppercased before lookup. Built in 6c
  (`server/utility/joinCode.js`): the alphabet is `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (31 characters,
  ~8.5×10^11 codes), drawn with `crypto.randomInt`.
- Generated **server-side, lazily** on the GC's first `GET /api/companies/join-code`. It isn't an
  offline-written record, so the client-generated-UUID rule (`CLAUDE.md`) doesn't apply.
- Linking is online-only (it needs a server lookup), with an explicit offline message in the UI.
- Guessing a code lets a sub link *itself* to a GC, not read anything, so the exposure is dashboard
  spam, not data. Rate-limiting `link-gc` is desirable, but the server has no rate limiter at all today
  (no `express-rate-limit` or similar in `package.json` or `server.js`), and adding one is a new
  dependency `CLAUDE.md` says needs approval. Recommendation: ship v1 without it (the 10^12 code space
  makes guessing impractical) and raise a server-wide limiter as its own decision.
- **No rotation or GC-side removal in v1** — see "Explicitly not resolved here."

### Link semantics

`POST /api/projects/:id/link-gc { joinCode }` (owner-scoped; **subcontractor accounts only** — a GC account
gets `403` via `requireSubcontractorCompany`, so a GC can't attach its own project to another GC, which
would later show up as a phantom "sub" on that GC's dashboard):

- Unknown code → `404`. Code belongs to the caller's own company → `422`.
- Already linked to the **same** GC → idempotent `200`. Linked to a **different** registered GC → `409`
  ("unlink first") — silently re-pointing a project would move a sub's history between GCs.
- Sets `gc_company_id` and **overwrites `gc_name_custom` with the GC company's registered name**, so every
  screen that shows it (project list, picker, PDF) shows the real name, and `check_gc_info` still holds after
  an unlink. *Superseded the original "keep the sub's text, fill only if empty" rule:* create already
  requires a GC name, so that fill branch could never fire and a sub who typed "Turner" would keep seeing
  "Turner" after linking to "Turner Construction Inc." The sub's originally typed text is not preserved.
- Upserts `(project_id, sub_id)` (the owning sub's company) into `project_subcontractors`.

`DELETE /api/projects/:id/link-gc` sets `gc_company_id` to `NULL` and deletes the `project_subcontractors`
row. `gc_name_custom` is retained, which satisfies `check_gc_info`.

`gc_contact_email` itself is untouched by linking. Its role in PDF delivery changed in Phase 8b, though:
once a project is linked, the PDF is emailed to the linked GC company's admin (a real account, resolved
via the Auth Admin API), not `gc_contact_email` — that field is now only a fallback for an unlinked
project or a linked company with no admin yet. Either way, the PDF still appears on the dashboard too —
dual delivery, on purpose.

### `project_subcontractors` is a roster, never an authorization source

Under the sub-owned model the table duplicates `owner_company_id` + `gc_company_id`. Recommendation:
still write `(project_id, owner_company_id)` on link, so a future GC-owned/multi-sub model and the roster
read one table. But **authorization keys on `projects.gc_company_id = caller` only** — one column on the
table itself, the same single-column shape every other service check uses (the reasoning
`docs/meeting-flow-design.md` gives for `meeting_logs.company_id`). supabase-js has no multi-statement
transaction, so the link's two writes can drift; because nothing authorizes off the junction table, drift
is a roster inconsistency, not a security problem. Cheap to drop if you'd rather not write it.

**Superseded by Phase 8d.** `docs/jobsite-design.md` makes a roster load-bearing after all — not this
table, but its re-keyed successor `jobsite_subcontractors`, which gates whether a sub may attach a
project to a specific jobsite. This table's own rows become 8d-g's backfill *input*, and
`project_subcontractors` itself is dropped in 8d-h once the backfill has read it. The "authorization
keys on `projects.gc_company_id` only" rule survives unchanged — 8d's new check is additive, gating
*admission*, not replacing the read-path check.

### GC authorization and data exposure

- `getUserContext` (`server/services/users.js`) joins `companies(company_type)` alongside `tier`;
  `loadUserContext` puts `companyType` on `req.user`. New `requireGcCompany` middleware → `403` for a
  non-GC company. (A `403` on the route is fine; existence of *data* is never leaked — below.)
- `assertGcLinkedProject(projectId, gcCompanyId)` in a new `server/services/gcDashboard.js` confirms
  `projects.gc_company_id = gcCompanyId`; anything else, including another GC's project, is a **`404`**,
  matching the "another company's row is indistinguishable from a missing one" rule `projects.update`
  documents.
- Only **completed** logs (`completed_at IS NOT NULL`) are exposed. In-progress rows never reach a GC.
- Access follows the **current** link: unlinking removes the GC's dashboard access to that project's
  history. Copies the GC already has (a downloaded PDF, a 30-day emailed link) are unaffected.
- **Minimum exposure:** `/api/gc` returns signer `worker_name` + quiz pass/fail and the PDF link. It does
  **not** expose crew-photo or signature-image URLs — the crew-photo retention question (PRD §7.2) is
  still open, and the PDF already embeds both for the GC's audit needs.
- **PDF filename bug to avoid:** `meetingLogs.getPdfUrl` builds the filename from the *caller's*
  company. For a GC caller that would name every file after the GC. The GC path builds it from the
  *meeting's* company (`meeting.companyId`) via the existing `buildPdfFilename`.
- **"Completed, PDF pending":** PDF generation is soft-fail (`docs/meeting-flow-design.md`), so
  `completed_at` can be set while `final_pdf_url` is `NULL`. The API returns `pdfReady: boolean`; the UI
  disables "Open PDF" with "PDF still being generated." `pdfGenerationQueue.enqueue` has exactly one call
  site, inside `complete()`, and no regeneration endpoint exists — so a failed generation is permanent, and
  becomes newly visible to GCs. Noted, not solved here.

### Compliance

v1 rule: a linked sub is **`logged`** if it has at least one completed meeting in the current period, else
**`missing`**; `lastLoggedAt` is the newest completed meeting in the period. **The period is daily by
product decision** — job sites change constantly, so hazards change daily.

- **Roster** = distinct `owner_company_id` across the GC's linked projects that are `status = 'active'`
  and not archived. A sub that linked but never logged appears as `missing` — the case the dashboard
  exists to catch.
- **Pure function.** `server/utility/compliance.js` takes `{ roster, logs, window: { start, end } }` and
  returns per-sub `{ status, lastLoggedAt, count }`. It has no concept of "daily," Express or Supabase. The
  service derives today's window and passes it in; a multi-day-window test locks the cadence-agnosticism in.
- **Status names** are cadence-neutral (`logged` / `missing` for the *current period*), so "today" →
  "this week" later is a label change, not a rewrite.
- **The "today" boundary:** the client sends its local `date` (`YYYY-MM-DD`) and `tzOffset` (minutes, same
  sign as `Date#getTimezoneOffset`, validated to ±14h); the server converts to a half-open UTC range
  `[start, end)`. The server never guesses a timezone. A GC with sites in several zones sees one boundary
  (the viewer's) — acceptable for v1.

**Decided — which timestamp counts: `meeting_logs.held_at`.** `meetingLogs.complete` stamps
`completed_at: new Date().toISOString()` at **server receipt** (`server/services/meetingLogs.js`), and
`created_at` is likewise a DB default. A foreman working offline all day and syncing the next morning
would produce a Monday talk stamped Tuesday: the GC sees Monday `missing` and Tuesday `logged`, on a
product whose selling point is an accurate audit trail. So:

- **Two timestamps, two jobs.** `held_at` is when the meeting was held, as the client reports it at
  completion (the wizard's local time when the foreman finishes). `completed_at` stays the server-receipt
  audit stamp. Compliance windows, the PDF's meeting date, the PDF filename and the email's date all use
  `held_at`. Where the PDF is concerned, the footer's existing "Generated" time is the server-receipt time
  (generation runs synchronously inside `complete()`), so the PDF carries both without a new line.
- **Column (6b):** nullable `TIMESTAMPTZ`, backfilled from `completed_at` so existing meetings keep the date
  and filename they have today.
- **Plumbing (6b2):** `PATCH /api/meetings/:id/complete` takes an optional `heldAt`. Absent → `held_at` =
  server receipt, so outbox rows already queued by shipped clients keep working. Present but more than ~5
  minutes in the future (clock skew) or more than **7 days** before receipt → **ignored**, `held_at` =
  server receipt, and the completion still succeeds. It deliberately does *not* reject with a `422`: the
  client's offline outbox retries a failed row forever with the same payload, so a rejected `heldAt` would
  strand a fully-signed meeting un-completed (no PDF, invisible to the GC). Only a malformed value (not
  ISO 8601 — impossible from our own client) is a validator `422`. `useCompleteMeetingLog` captures it when
  it enqueues the completion row (`MeetingWizard.tsx` is unchanged). Implemented in
  `server/utility/heldAt.js`.
- **Trust:** a client-supplied time can be backdated, which is why `completed_at` is kept and the GC detail
  view shows both (a "received later" cue when they differ). The 7-day bound limits how far back a sub can
  push a log, but it isn't tamper-proof — the same trust boundary as every other client-reported field, with
  `completed_at` as the server-side evidence.
- **Known limitation, pre-existing:** `formatDate` prints in UTC and `held_at` is a `timestamptz` (no zone
  kept), so a late-evening West Coast talk could show the next calendar date on the PDF. Fixing it means
  storing the foreman's tz offset; tracked as a follow-up in `docs/tasks.md`, not done here.

### Jobsite grouping

A GC's linked rows are grouped by **`(gc_company_id, normalized project name)`** — trimmed,
whitespace-collapsed, lowercased. The display name is the earliest row's original spelling. If one sub has
two rows under the same key, they merge (`logged` if either logged). This is deliberately fuzzy:
"Riverside Tower" and "Riverside Twr" become two jobsites, and the GC can't merge them in v1. That
limitation is the concrete argument for the GC-owned canonical jobsite later.

### Configurable cadence (design only — not built)

Daily is decided; the GC and/or an individual sub (some subs will want weekly) is expected to configure it
later. When that lands:

- **Owner and conflicts:** the natural model is a GC-level default with a per-sub override, with the GC's
  setting acting as a *floor* a sub can tighten but not relax — otherwise a sub could opt itself out of
  daily talks the GC requires. Per-project cadence is the alternative if one GC's sites differ. To decide
  with real GCs, not now.
- **Storage:** a small `cadence` value on the relevant row (company default; `project_subcontractors` is a
  natural home for a per-sub-per-site override — another reason to write it now).
- **Computation:** the overview derives a *per-sub* window instead of one shared "today," and calls the
  same `compliance.js` per sub. The function and status names don't change.
- **Nothing in Phase 6** adds a cadence column, endpoint parameter or settings UI.

## RLS finding: code and docs disagreed — resolved in 6b

`docs/data-access.md` says RLS "stays enabled with no policies on every table", listing `companies`,
`users`, `projects` and `project_subcontractors`. `Supabase_SQL.sql` only ever ran
`ENABLE ROW LEVEL SECURITY` on `toolbox_talks`, `user_favorites`, `meeting_logs`, `signatures` and
`waitlist`; the comments in the SQL itself called the others a "pre-existing gap." The live database
couldn't be inspected from here, so it may have been enabled by hand — unknown.

It mattered now: 6b puts `join_code` on `companies`, and the client bundles the public `anon` key. Without
RLS on that table, a leaked-key client could read every company's join code. **Resolution:** 6b adds
`ENABLE ROW LEVEL SECURITY` (with **no policies**) for `companies`, `users`, `projects` and
`project_subcontractors`, making `docs/data-access.md`'s claim true once the SQL is applied. This is safe
and consistent with the server-brokered model — the server and every script use the service-role key, which
bypasses RLS, and the client never queries these tables (it only creates the Supabase *auth* client). If a
trigger was ever created by hand in the Supabase dashboard, it must be `SECURITY DEFINER` (table owners
bypass RLS); the repo's SQL defines none.

## Endpoint contract

All under `requireAuth → loadUserContext → requireGcCompany`, `{ success, data }` responses, camelCase. Built in
6e (`server/services/gcDashboard.js`, `server/controllers/gc.js`, `server/routes/gc.js`); see `docs/tasks.md`'s
6e entry for the small deviations from the table below, folded in here.

| Endpoint | Returns |
| --- | --- |
| `GET /api/gc/overview?date&tzOffset` | `{ jobsites[], totals }` — each jobsite `{ name, subs[]: { companyId, companyName, projectId, status, lastLoggedAt, count } }`; `totals: { subs, logged, missing }` counts sub-per-jobsite entries |
| `GET /api/gc/meetings?projectId&from&to` | Up to 200 completed logs (no pagination in v1) for the GC's linked projects, newest `held_at` first: `{ id, projectId, projectName, companyId, companyName, talkTitle, heldAt, completedAt, signerCount, pdfReady }` — `from`/`to` filter on `held_at` |
| `GET /api/gc/meetings/:id` | Log detail (same fields as the list row) + `signers[]` (`workerName`, `quizPassed`), with both `heldAt` and `completedAt` |
| `GET /api/gc/meetings/:id/pdf-url` | Signed URL (5-min TTL, filename from the *meeting's* company and `held_at` date); `404` if `!pdfReady` |

`projectId`/`companyId`/`companyName` on meeting rows weren't in the original contract — added because a list
spanning several subs and jobsites is unreadable without them. A jobsite that merges two of one sub's project
rows (see "Jobsite grouping" above) reports that sub's **earliest** project id as `projectId`.

Sub-side link endpoints (`POST`/`DELETE /api/projects/:id/link-gc`) and the GC's
`GET /api/companies/join-code` are specified under "Join code" and "Link semantics."

## Client notes

- `/gc` sits behind a new `RequireGc` (extends the `RequireAuth` pattern; non-GC → `/dashboard`).
  `useCurrentUser` starts returning `role`, `companyId` and `companyType` — already fetched in
  `CurrentUser`, currently discarded.
- **Online-only, read-only.** No outbox, no new Dexie tables, no offline cache. The TanStack `QueryClient`
  runs `staleTime: 0`, so a GC returning to the tab always sees fresh status.
- Every query is wrapped in a domain hook (`useGcOverview`, `useGcMeetings`, `useGcMeetingPdfUrl`), not
  inline in components. "Open PDF" fetches its signed URL on click, so a 5-minute URL never goes stale in
  the DOM.
- The Dashboard's disabled "GC Compliance" card enables only for GC companies. There is no table, badge or
  card primitive in `ui_comps/`; 6f copies the local `Styled*` patterns from `features/projects/styles.ts`
  and promotes them only if a second consumer appears.

## Explicitly not resolved here

**GC-side unlink, sub removal and code rotation.** A wrong sub linking itself (or a leaked code) can be
undone only by that sub unlinking; the GC has no remove-sub or regenerate-code control in v1. Worth
resolving by the invite epic at the latest.

**Email invites, role enforcement, `gc_contact_email` supersession.** Tracked in `docs/tasks.md`'s Phase
8 epic; three of its four items are now designed or shipped. Roles are real as of Phase 8a (an
`admin`/`safety_manager` gate exists and is enforced on project archive/restore/delete and custom-talk
delete), `gc_contact_email` was superseded for linked projects as of Phase 8b, and user-to-company email
invites shipped in Phase 8c — but neither the GC dashboard nor the join-code endpoints ever picked up a
role gate; any signed-in user in a GC company can still see the dashboard and its join code. Phase 8d's
`docs/jobsite-design.md` designs company-to-company invites and the GC-owned jobsite model (fixing the
role-gate gap for free on every new jobsite endpoint, and flagging — but not itself closing — the
retrofit onto `GET /api/companies/join-code`); 8d's sub-steps (8d-b onward) are unbuilt as of this
writing.

**Configurable cadence, GC tier gating (blurred subs, 1-site cap), SMS nudges, Procore/ACC sync, OSHA
Defense ZIP, cross-project scorecards.** Deferred; see `docs/tasks.md`.

**Crew-photo retention** (PRD §7.2) — unchanged; the reason GCs don't get photo URLs above.

**PDF regeneration** when generation soft-failed — not built; see "Completed, PDF pending."

**Multi-timezone GCs** — one viewer-local day boundary in v1.

## Landing order

1. This design doc (6a), plus `docs/data-access.md`'s GC read path.
2. Schema (6b): `companies.join_code`, `meeting_logs.held_at`, and the RLS statements — SQL and docs only.
3. `held_at` plumbing (6b2): the completion endpoint, PDF header, PDF filename, email date and the wizard's
   completion payload. Before 6e, which reads it.
4. Server identity + link endpoints (6c), including closing `gcCompanyId` on create/PATCH.
5. Client identity + linking UI (6d).
6. Server GC read APIs + compliance function (6e) — pure function first, then the service, then routes.
7. Client GC dashboard (6f).
8. Docs and the two-account manual smoke (6g).
