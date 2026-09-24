# Jobsite Design (Phase 8d)

Status: **decided** (8d-a design spike). Covers how a GC creates and owns a real jobsite, how a
subcontractor company joins one (by join code or by email invite), how authorization changes to
admit a sub onto a specific jobsite, and the sequencing 8d-b…8d-h implement. Full plan and
sequencing: `~/.claude/plans/let-s-work-on-8d-cuddly-crab.md` (design backing doc:
`~/.claude/plans/let-s-work-on-8d-cuddly-crab-agent-aab737ac2ca15e0ab.md`).

## Why this doc exists

`docs/gc-dashboard-design.md` (Phase 6a) deliberately shipped a stopgap: a GC "jobsite" is not a
real row, just `server/utility/jobsites.js` fuzzy-grouping a GC's linked `projects` by normalized
name. That doc named the limitation directly — "Riverside Tower" and "Riverside Twr" can't be
merged — and deferred the fix as "the GC-owned canonical jobsite later." It also left two things
unbuilt: a GC has no way to create a site directly (only a sub can link itself in, via a join
code), and a GC has no way to invite a sub company by email — only 8c's user-to-company invite
exists, which is unrelated (a person joining one company, not a company joining another's site).

This doc makes both real, without disturbing the two things Phase 6/8 already got right: the
single-column authorization convention (`docs/meeting-flow-design.md`'s reasoning for
`meeting_logs.company_id` — no join-based scoping on a hot read path) and the offline-first client
model (client-generated UUIDs before any DB write, per `CLAUDE.md`'s offline-sync rule).

## Decisions made before this doc (locked via user sign-off, not reopened here)

1. **Additive and permanent.** A sub's project can exist forever with no GC, or with just free-text
   `gc_name_custom`/`gc_contact_email`. GC-owned jobsites are never the only path — the whole design
   below depends on this.
2. **The join code stays**, rewritten to attach to a real jobsite instead of just setting
   `gc_company_id` on a fuzzy-grouped row. It remains the zero-friction, no-email linking path.
3. **A GC can invite an unregistered sub by email.** The GC never pre-creates a `companies` row;
   the invitee names their own company on signup, forced to `company_type = 'subcontractor'`.

## Decisions

### Data model: a real `jobsites` table, `projects` unchanged in kind

```sql
CREATE TABLE jobsites (
  id               UUID PRIMARY KEY,          -- server-generated, see "Offline-sync rule" below
  gc_company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  status           project_status NOT NULL DEFAULT 'active',
  archived_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
```

```sql
-- Folds the invite and the roster into one table — see "Company-to-company invite" below.
CREATE TABLE jobsite_subcontractors (
  id               UUID PRIMARY KEY,           -- server-generated
  jobsite_id       UUID NOT NULL REFERENCES jobsites(id) ON DELETE CASCADE,
  sub_company_id   UUID REFERENCES companies(id) ON DELETE CASCADE,  -- NULL until accepted
  invited_email    TEXT NOT NULL,
  token            TEXT UNIQUE,                 -- NULL once accepted
  expires_at       TIMESTAMPTZ,                 -- NULL once accepted
  accepted_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT jobsite_subs_email_unique UNIQUE (jobsite_id, invited_email)
);
CREATE UNIQUE INDEX jobsite_subs_company_unique
  ON jobsite_subcontractors (jobsite_id, sub_company_id)
  WHERE sub_company_id IS NOT NULL;
```

```sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS jobsite_id UUID REFERENCES jobsites(id) ON DELETE SET NULL;
```

`project_subcontractors` was untouched by this step and dropped in 8d-h, after 8d-g's backfill
had read it.

**Why `projects` survives as the sub's own row, rather than a GC-owned row replacing it.** A sub's
`projects` row becomes "this sub's participation in that jobsite": it still carries the sub's own
`status`/`archived_at`, still owns its `meeting_logs`, still keys the outbox and `projectsCache` by
the same client-generated UUID it always has, and still satisfies `check_gc_info` (accept copies the
GC's registered name into `gc_name_custom`, exactly what `linkGc` already does today). Rejected the
alternative — relaxing `owner_company_id` so one `projects` row could be shared by a GC and N subs:

1. **`projects.status`/`archived_at` are per-sub workflow state.** One sub archiving its own site
   would delete the whole jobsite from every other sub's — and the GC's — view.
2. **`meeting_logs.company_id` breaks.** `meetingLogs.create` verifies
   `projects.owner_company_id === req.user.companyId` and denormalizes that company onto the log. A
   GC-owned row means the owner *is* the GC, so the ownership check and the denormalization diverge
   — reaching into `meetingLogs.js`, `signatures.js`, `storage.js` and `pdfGenerationQueue.js`, i.e.
   all of Phase 4/5.
3. **`check_gc_info` becomes meaningless** on a GC-owned row (the owner is the GC), needing a
   conditional rewrite.
4. **Every existing `.eq("owner_company_id", …)` filter** (`projects.getById`/`update`/`remove`/
   `linkGc`/`unlinkGc`, `meetingLogs.create`) would need to reason about two row kinds behind one
   nullable column — the opposite of `CLAUDE.md`'s "prefer minimal, surgical diffs."

**Why `projects.gc_company_id` is retained rather than replaced by a `projects → jobsites` join.**
Authorizing a GC via `projects.jobsite_id → jobsites.gc_company_id` would be this codebase's first
join-based authorization check on a hot read path, which `docs/meeting-flow-design.md` argues
against by name, and which this doc's own "roster, never an authorization source" section (below)
reiterates for the new roster table. Keeping `gc_company_id` and writing it at the same moment
`jobsite_id` is written is the same pattern `meeting_logs.company_id` already uses: one denormalized
column, set once at attach time, never updated after. `gcDashboard.assertGcLinkedProject`,
`gcDashboard.listLinkedProjects`, `projects.listForCompany`'s `.or()` and
`pdfGenerationQueue.resolveGcContactEmail` all keep working with **zero changes**.

**Offline-sync rule (`CLAUDE.md`).** `jobsites.id` and `jobsite_subcontractors.id` are
**server-generated** — the same documented exception `companies.join_code`, `company_invites.id`
and `waitlist.id` already carry, because creating a jobsite, sending an invite, and accepting one
are all online-only actions needing a live server round-trip (a token must be validated against
live data), exactly the posture `linkProjectToGc` and `useInviteTeammate` already take
(`networkMode: "always"`, no outbox). A `projects` row created by the server during an invite
accept also gets a server-generated id — an online write, not an offline one; the sub's later
offline edits to it key off the id the server returned, the same as any project created online
today. The sub's own offline-created projects (no `jobsiteId`) are unaffected — still
client-UUID-generated, still routed through the outbox exactly as they are now.

### Authorization: what "load-bearing" actually means

Four distinct questions, three of which need no change:

| Question | Check | Changes in 8d? |
| :--- | :--- | :--- |
| Can this GC read this project's meetings / PDF? | `projects.gc_company_id = req.user.companyId` | No |
| Can this sub log a meeting / edit / archive this project row? | `projects.owner_company_id = req.user.companyId` (+ `MANAGER_ROLES` where 8a added it) | No |
| Can this GC edit / invite to this jobsite? | `jobsites.gc_company_id = req.user.companyId` (+ `requireGcCompany`, `requireRole(...MANAGER_ROLES)`) | New, same single-column shape |
| **Can this sub attach a project row to *this* jobsite?** | **An accepted `jobsite_subcontractors` row exists for `(jobsite_id, sub_company_id = caller)`** | **New — the load-bearing addition** |

The fourth row is the genuine security boundary: without it, any sub could
`POST /api/projects { jobsiteId }` and inject itself into any GC's dashboard — the identical
spoofing hole 6c closed by making `gcCompanyId` unwritable from a request body on project
create/PATCH. The accepted roster row is now the admission-control list, and `gc_company_id` is
derived *from* it (copied server-side at accept/link time), never accepted from the request. 6c's
decision is preserved, with the accepted roster row as the second (and only other) writer alongside
`link-gc`.

This does **not** reopen a join-based check: the lookup is a unique-index read on the table that
*holds the fact* —

```js
// server/services/jobsites.js — shape only
const { data, error } = await supabase
  .from("jobsite_subcontractors")
  .select("id")
  .eq("jobsite_id", jobsiteId)
  .eq("sub_company_id", companyId)   // always req.user.companyId, never request input
  .not("accepted_at", "is", null)
  .single();
```

— the same shape as `companies.getByJoinCode`. A missing row is a **404**, matching "another
company's row is indistinguishable from a missing one." Because `gc_company_id` is copied onto the
project row at attach time, **no later read ever consults the roster table** — the single-column
shape is preserved on every hot path.

Known accepted drift, same reasoning as today's `linkGc`: supabase-js has no cross-table
transaction, so the two writes (roster accept, project insert) can drift. Drift here means "an
accepted sub with no project row yet" — a retryable no-op, not a privilege, healed by
`UNIQUE (jobsite_id, sub_company_id)`-guarded idempotency on retry.

New middleware needed: none. Reused unchanged: `requireAuth` (incl. `req.userEmail`, added in 8c),
`loadUserContext` (incl. `req.user.name`/`companyType`/`role`), `requireGcCompany`,
`requireSubcontractorCompany`, `requireRole(...MANAGER_ROLES)`, `validate`, `AppError` + the global
handler. Accepting an invite is manager-gated (`requireRole(...MANAGER_ROLES)`) — it binds the
whole company to a GC's site, the same class of action 8a gated for archive/delete. For the
signup-and-accept path (Case B below) the acceptor is the new company's `admin` by construction, so
no extra gate applies.

### Company-to-company invite

**Fold the invite into the roster** — `jobsite_subcontractors` *is* the invite record, with
`accepted_at IS NULL` meaning "invited, not yet accepted." Not a widened `company_invites` (its
whole shape is "this *person* joins this *company* at this *role*" — `UNIQUE(company_id, email)`,
`role user_role NOT NULL`; a jobsite invite has no role and its subject is a company, not a person)
and not a separate `jobsite_invites` table (the GC dashboard needs "Acme Roofing — invited, hasn't
accepted" and "invited, accepted, never logged" without a union read on every overview). No
orphan-cleanup question either: 8c's `deleteInvite` exists because a consumed `company_invites` row
has no further purpose; here the row's whole point is to persist as the membership.

Guarded re-invite is the one thing folding must get right: `createJobsiteInvite` upserts on
`(jobsite_id, invited_email)` **only when `accepted_at IS NULL`**; re-inviting an already-accepted
sub is a `409 "That subcontractor is already on this job site"`. Implemented as a
read-then-conditional-upsert guarded by `.is("accepted_at", null)` on the update leg — the same
race-safe `.is(...)` trick `companies.getOrCreateJoinCode` and `projects.linkGc` already use.
Trade-off accepted: a consumed row keeps a dead `token`/`expires_at` (nulled on accept), cheaper
than a second table plus a union read.

#### Endpoints

All `{ success, data }`, camelCase, explicit statuses.

| Endpoint | Guard | Notes |
| :--- | :--- | :--- |
| `POST /api/jobsites` | `requireGcCompany`, `requireRole(...MANAGER_ROLES)` | `{ name }` → server-generated id |
| `GET /api/jobsites` | `requireGcCompany` | The GC's jobsites + roster, incl. pending invites |
| `PATCH /api/jobsites/:id` | `requireGcCompany`, `requireRole(...MANAGER_ROLES)` | `name`, `status`, `archived` — `archived` gated in the service layer, mirroring `projects.update`'s 8a reasoning for mixing gated/ungated fields on one PATCH |
| `POST /api/jobsites/:id/invite` | `requireGcCompany`, `requireRole(...MANAGER_ROLES)` | `{ email }`. Token **never** echoed in the response — only `{ email }`, exactly 8c's rule |
| `GET /api/jobsites/invite/:token` | Public, no `requireAuth` — the token is the credential | Preview → `{ gcCompanyName, jobsiteName, email }`. 404 collapses not-found *and* expired, same as `companyInvites.getActiveInvite` |
| `POST /api/jobsites/invite/:token/accept` | `requireAuth`, `loadUserContext`, `requireSubcontractorCompany`, `requireRole(...MANAGER_ROLES)` | Case A below |
| `DELETE /api/jobsites/:id/subcontractors/:subId` | `requireGcCompany`, `requireRole(...MANAGER_ROLES)` | Closes the "GC-side unlink / sub removal" gap `docs/gc-dashboard-design.md` left open |

`POST /api/projects` gains an optional `jobsiteId`, admitted only via the accepted-roster check in
the previous section; `requireSubcontractorCompany` stays on that route — a GC still never creates
a `projects` row directly, it creates a *jobsite*.

#### Accept semantics — Case A: an already-registered sub company

1. Invitee opens `/jobsite-invite/:token` (public route, outside `RequireAuth`, self-guarding like
   `ResetPassword` and 8c's `/invite/:token`).
2. Preview renders the GC name + jobsite name + the invited email.
3. If signed in, `POST /api/jobsites/invite/:token/accept` checks, in order:
   - `req.userEmail` (token-verified, **never** `req.body`/`req.userMetadata`) matches
     `invited_email`, case-insensitively → else `403 "This invite was sent to a different email
     address"`. Lifted verbatim from `companyInvites.getInviteForEmail` — the check that stops a
     leaked token being claimed by a different email.
   - Caller's company is a `subcontractor` (`requireSubcontractorCompany`) — a GC cannot be a sub on
     another GC's jobsite in v1.
   - Caller's role is in `MANAGER_ROLES`.
   - Invite is active (`accepted_at IS NULL`, not expired) → else 404 / 409.
4. On success, in order: stamp `sub_company_id`, `accepted_at = now()`, `token = NULL`,
   `expires_at = NULL`; **then** insert the sub's `projects` row (`owner_company_id = caller`,
   `jobsite_id`, `gc_company_id = jobsites.gc_company_id`, `name = jobsites.name`,
   `gc_name_custom` = the GC's registered name, server-generated id). Roster first, so the admission
   check is already true when the project insert runs — the same validated path a later manual
   create would take.
5. If signed out / no account: the invitee signs up through the link and lands back here — Case B.

#### Accept semantics — Case B: an unregistered sub company (email only)

Today a `companies` row is created **only** by `usersService.createProfile` from the signing-up
user's own `user_metadata.companyName`/`companyType`. **The GC never pre-creates a `companies` row**
for an invitee — doing so would squat a company name the GC doesn't own, fork identity if that sub
later self-signs-up, and assign a `tier` the GC didn't buy. The `invited_email`-only roster row
(`sub_company_id IS NULL`) *is* the placeholder.

The invitee signs up through the invite link with `user_metadata = { name, companyName, companyType:
"subcontractor", jobsiteInviteToken }`. This is the **inverse** of 8c: 8c's invited signup *skips*
`companyName`/`companyType` because the company already exists; here it *requires* `companyName`
(the invitee names their own company) and forces `companyType: "subcontractor"`.

- `requireProfileMetadata.js` gets a **third branch**, alongside the existing `inviteToken` branch
  (`server/middlewares/requireProfileMetadata.js` lines 20–28): `jobsiteInviteToken` present →
  require `name` **and** `companyName`, and force `companyType = "subcontractor"` rather than
  reading it from metadata (a GC must not be able to self-declare into a sub invite). The two token
  keys are mutually exclusive — both present is a `422`.
- `usersService.createProfile` gets a **third branch**, `createProfileWithJobsiteInvite`: create the
  `companies` row + the `users` row (role `admin`, same as any company founder — reuse
  `createProfile`'s existing body and its compensating `companies` delete on a failed `users`
  insert, `server/services/users.js` lines 21–61), **then** accept the jobsite invite as the last
  step. That ordering mirrors `createProfileFromInvite`'s "consume the invite only after the `users`
  insert actually succeeds" (lines 97–105): a failed accept leaves a working account and a still-
  valid token, recoverable via Case A on next login. Best-effort, logged, never throws past profile
  creation.
- `AuthProvider`'s background `createProfile()` safety net (the 8c bug fix, `auth-provider.ts`)
  works unchanged — the token rides in `user_metadata`, so the deferred confirm-email path is
  covered for free.

#### Reuse ledger for 8c's machinery

**Reusable verbatim, no change:** `server/utility/inviteToken.js` (`generateInviteToken()`,
`getInviteExpiry()`); the Mailgun soft-fail shape in `server/services/email.js` → add
`sendJobsiteInviteEmail({ to, gcCompanyName, jobsiteName, inviterName, acceptUrl })`, a near-copy of
`sendCompanyInviteEmail` (lines 104–129); a new `MAILGUN_TEMPLATES.JOBSITE_INVITE` in
`server/constants/templates.js`; a new `docs/mailgun-templates/jobsite-invite.html` copied from
`company-invite.html`; `requireAuth`'s `req.userEmail` and `loadUserContext`'s `req.user.name` (both
added in 8c specifically for this kind of flow); the public-preview route pattern (no `requireAuth`,
the token *is* the credential) and its minimal-disclosure 404-collapse; the client shapes —
`InviteTeammateForm.tsx` (own RHF form + mutation, `networkMode: "always"`, no outbox) →
`features/jobsites/InviteSubcontractorForm.tsx`; `pages/AcceptInvite/` →
`pages/AcceptJobsiteInvite/`; `hooks/useInvitePreview.ts`/`useInviteTeammate.ts` → their jobsite
twins (per the standing rule: a domain custom hook, never an inline `useMutation`).

**Needs its own parallel implementation:** the service (new `server/services/jobsites.js` — see the
naming-collision flag below); `createInvite`'s blind upsert → the `accepted_at IS NULL`-guarded
upsert above; `deleteInvite` → stamping `accepted_at` + nulling the token, row persists; the
authenticated accept endpoint (8c has none at all — acceptance happens only inside `createProfile`;
8d needs *both* that path and an authenticated accept-as-an-existing-company path, the single
largest genuinely new piece of the invite work); `requireProfileMetadata`'s and `createProfile`'s
third branches.

**Explicitly not reusable:** the `company_invites` table, `previewInvite`'s return shape, `user_role`
(a jobsite invite has no role), and 8c's `/invite/:token` client route (kept for team invites; the
jobsite one is a distinct path so a user with both pending invites isn't ambiguous).

### Join code: dual-run rewrite, not retirement

`POST /api/projects/:id/link-gc` is **rewritten, not retired**. It stays the zero-friction, no-email
path (the GC dashboard's empty state advertises it, and 6d's client UI already ships). It resolves
the GC by join code exactly as today, then *finds-or-creates* a `jobsites` row for
`(gc_company_id, normalizeJobsiteName(name))` — reusing `server/utility/jobsites.js`'s own exported
`normalizeJobsiteName` (renamed `jobsiteGrouping.js`, see Flags) — and sets `jobsite_id` plus an
accepted roster row alongside `gc_company_id`, the same moment it already sets `gc_company_id`
today. `DELETE .../link-gc` mirrors this: nulls `gc_company_id` **and** `jobsite_id`, and removes the
roster row unless the sub still has another project on that jobsite. This applies to invite-attached
projects too (decided in 8d-h: a sub may leave a GC-invited jobsite; the GC can re-invite). After 8d-h, every linked project has a real jobsite — there is exactly one runtime
shape, whether the sub arrived via join code or via an accepted invite.

### GC dashboard changes

`gcDashboard.getOverview` (8d-h) reads real, active, non-archived `jobsites` rows and their
**accepted** roster instead of grouping projects by name — so an accepted-but-never-logged sub shows
as `missing`, the case the dashboard exists to catch (a still-pending invite has no company yet and is
not listed). `GcJobsite` gains a real `id`; `JobsiteList.tsx` keys on it. A sub's `projectId` (the
drill-in target) is its earliest active project in that jobsite, or `null` when it has none, in which
case the drill-in makes no request. **No dual-run branch:** a linked project with `jobsite_id IS NULL`
no longer appears, so `node scripts/backfill-jobsites.js --apply` must be run before 8d-h is
deployed. A jobsite with no accepted subs (e.g. the only sub unlinked) stays on the dashboard with a "no subcontractors yet" message and a link to `/projects` to invite some; the GC archives it there to remove it.

### Migration: no existing link can be stranded

The 8d-g backfill groups every `projects` row with `gc_company_id IS NOT NULL AND jobsite_id IS
NULL` by `(gc_company_id, normalizeJobsiteName(name))` — the exact key the dashboard already
displays by — inserts one `jobsites` row per group (name = the earliest row's original spelling,
matching `groupProjectsIntoJobsites`'s existing display rule), sets each project's `jobsite_id`, and
inserts an accepted `jobsite_subcontractors` row per distinct `owner_company_id` in the group
(`invited_email` = that sub's admin email via the existing `usersService.getAdminEmail`, or a
documented placeholder when it has none yet — that nullable case already exists per 8b).
`gc_company_id` needs no rewrite anywhere in this process — it is already correct on every row,
which is why **no GC's dashboard can go dark mid-migration**: the column that grants read access is
untouched by the backfill, so `GET /api/gc/overview` keeps working identically whether or not the
script has run yet.

## Worked examples

Three end-to-end walkthroughs of the two entry points a sub can arrive by. All three land in the
same place: a `projects` row with `jobsite_id` set, pointed at a real `jobsites` row the GC can see
on their dashboard.

### Example 1 — GC invites a sub that's already on TailgatePro

1. A GC admin, on their "Riverside Tower" jobsite, enters `jane@acmeroofing.com` and clicks Invite.
2. `POST /api/jobsites/:id/invite` creates a `jobsite_subcontractors` row
   (`invited_email: "jane@acmeroofing.com"`, `sub_company_id: NULL`, a fresh token) and
   `sendJobsiteInviteEmail` sends Jane a link.
3. Jane, already an Acme Roofing admin, clicks it, logs in, and `GET /api/jobsites/invite/:token`
   previews "Turner Construction invited Acme Roofing to Riverside Tower."
4. She accepts. `POST /api/jobsites/invite/:token/accept` runs Case A: confirms `req.userEmail`
   matches the invite, confirms she's a subcontractor admin/safety_manager, stamps
   `sub_company_id`/`accepted_at`, then inserts a new `projects` row for Acme
   (`owner_company_id` = Acme, `jobsite_id` set, `gc_company_id` copied from the jobsite).
5. Acme's crew now sees "Riverside Tower" in their project picker — nobody at Acme typed a project
   name, a join code, or anything else.

### Example 2 — GC invites a sub that's never used TailgatePro

1. Same first two steps as Example 1, but the email (`bob@newcosubcontractor.com`) has no account
   anywhere.
2. Bob clicks the invite link while signed out, so instead of the accept flow he's sent to a
   signup form pre-filled with his email and `user_metadata.jobsiteInviteToken` carrying the token.
   The form additionally asks him to name his own company — the GC never pre-creates one for him
   (see "Accept semantics — Case B" above for why).
3. On confirmed signup, `requireProfileMetadata`'s third branch forces `companyType:
   "subcontractor"` regardless of what Bob's metadata says, and `createProfileWithJobsiteInvite`
   creates his `companies` row, makes him its `admin`, then accepts the jobsite invite the same way
   Case A does — stamping the roster row and inserting his `projects` row.
4. Bob now has a full, standalone TailgatePro company account (same `tier: "basic"` any self-signup
   gets — see "Company account, not a guest account" below), already attached to Riverside Tower.

### Example 3 — A registered sub uses the existing join code (no invite at all)

This is the pre-8d self-service path (Phase 6), unchanged in spirit — it stays as the
zero-friction alternative to being invited.

1. A sub, already signed up with their own project ("Riverside job"), enters Turner Construction's
   permanent join code (shown on Turner's dashboard/settings, not tied to any one sub or email).
2. `POST /api/projects/:id/link-gc` resolves the code to Turner, as it does today.
3. Since 8d-h, it also finds-or-creates a `jobsites` row for
   `(gc_company_id, normalizeJobsiteName("Riverside job"))` — reusing whichever jobsite row already
   exists for Turner's Riverside site (e.g. the one Example 1's Acme is already on, if the
   normalized names match) — and attaches the sub's project via `jobsite_id`, inserting an accepted
   `jobsite_subcontractors` row alongside it.
4. The sub ends up in the exact same state as an invited sub: a project pointed at a real jobsite,
   correctly rolled up on Turner's dashboard — they just chose to self-attach instead of waiting for
   an email.

### Company account, not a guest account

The company created in Example 2 is not a limited or GC-scoped account — `createProfileWithJobsiteInvite`
reuses the same `companies`-row-creation logic as any ordinary self-signup, just triggered by the
invite link. Bob's company gets its own admin, can invite its own teammates (Phase 8c), can create
its own projects beyond Riverside Tower, and is set to `tier: "basic"` — the same default every
self-serve signup gets. There's no "invited via a GC" flag on the row, so nothing needs to unwind
later: `docs/tasks.md`'s Deferred section notes Stripe billing isn't built yet and is explicitly
waiting on multi-user/site concepts (this epic) to land first — once it exists, an invite-created
company upgrades exactly like any other `basic`-tier company, because by then it *is* one in every
way that matters.

## Explicitly not resolved here

**Sub removal and historical access.** `DELETE /api/jobsites/:id/subcontractors/:subId` applies the
same rule as today's unlink: nulls that sub's `jobsite_id` and `gc_company_id` on that jobsite,
which also revokes the GC's dashboard access to that project's *history* (copies the GC already has
— a downloaded PDF, a 30-day emailed link — are unaffected, same as `docs/gc-dashboard-design.md`'s
"Access follows the current link" rule). Flagging for a future revisit: on an audit-trail product, a
GC losing its own compliance history on removal is a real product question, just not one 8d
resolves differently than Phase 6 already did.

**Jobsite rename vs. a sub's project name.** *(Revised after 8d-e/8d-f review.)* The jobsite name is the
GC's, and a project attached to it (`jobsite_id` and `gc_company_id` both set) takes that name at accept (or
join-code link). The sub owns the row but **cannot rename it**: `projects.update` rejects a changed `name` on an
attached project (403) and `ProjectForm` shows it read-only. Reason: the name feeds `buildPdfFilename` and
the join-code find-or-create matches on it (the dashboard itself now reads real `jobsites` rows, 8d-h). The same guard covers a GC-linked project's GC name (the GC's registered name) and manual
`gc_contact_email` (moot — PDF delivery resolves the GC admin's email first, Phase 8b, so the form shows it locked
and empty rather than prefilled, never disclosing the admin's address). A GC rename still does not rewrite an
attached project's `projects.name` retroactively — a known, accepted drift: the dashboard shows the jobsite's
own name, while the sub's project keeps the name it took at attach time. Unlinking (which nulls `gc_company_id`) frees these fields again.

**Multiple project rows per sub per jobsite.** The roster's `UNIQUE (jobsite_id, sub_company_id)`
enforces one *membership* per sub per jobsite, but nothing stops a sub from holding several
`projects` rows with the same `jobsite_id` (e.g. separate crews or phases) — `gcDashboard`'s
per-sub rollup already has a "merge this sub's several rows" path to reuse from the old fuzzy
grouper, so this is additive capability, not a gap.

**`jobsites.gc_company_id` staying GC-only.** In real construction a large sub subcontracts
further. Decided GC-only for v1 (would need a `check_join_code_gc_only`-style CHECK enforced at the
service layer, since `jobsites` has no `company_type` column of its own to constrain directly) —
flagging because the column's name locks the assumption in; relaxing it later is a rename, not just
a data change.

**Tier gating.** `docs/pricing-and-positioning-strategy_V2.md` and Phase 6's deferred list mention a
GC "1-site cap"/blurred subs. Explicitly **out of scope for 8d** — decided now rather than left
ambiguous, because retrofitting a cap onto jobsites that already exist is worse than shipping
without one and adding it deliberately later via `server/utility/entitlements.js` (the Phase 7
pattern).

**Accept auto-create vs. adopting an existing project.** On accept, the server **auto-creates** the
sub's `projects` row rather than asking the sub to pick one — matches the field-UX rule ("minimal
typing," `docs/responsive.md`). If the sub already has a project whose normalized name matches the
jobsite's, the accept response can surface a one-time "you already have '<name>' — attach it
instead?" prompt in 8d-f's client, but the server never silently re-points an existing row's
`jobsite_id` (that would re-scope a row whose meeting history belongs to whatever it was before).

**Configurable cadence, SMS nudges, Procore/ACC sync, OSHA Defense ZIP, cross-project scorecards,
crew-photo retention, PDF regeneration, multi-timezone GCs.** Unchanged by 8d; see
`docs/gc-dashboard-design.md`'s own "Explicitly not resolved here" and `docs/tasks.md`.

## Flags — code/doc mismatches found while designing this

1. **`ProjectForm.tsx`'s `isGc` branch is dead for create and broken for edit.**
   `client/src/pages/Projects/Projects.tsx` hides the "New project" button behind
   `isSubcontractor &&`, so a GC can never reach create mode; and `PATCH /api/projects/:id` is
   owner-scoped, so a GC opening Edit on a project it only has `gc_company_id` on hits a live 404 —
   yet `ProjectList.tsx` renders an unconditional Edit button for every project a GC sees today.
   8d-e removed the `isGc` branch from `ProjectForm.tsx` once a GC had a real create surface
   (`JobsiteForm`). Rather than gating `ProjectList`'s Edit button on ownership, `pages/Projects`
   now renders `JobsiteManager` instead of the project list for a GC, so the button is unreachable.
2. **Naming collision.** A new `server/services/jobsites.js` would sit beside the existing
   `server/utility/jobsites.js`. 8d-c's first commit renames the utility to
   `server/utility/jobsiteGrouping.js` (its one consumer is `server/services/gcDashboard.js`, plus
   its own test file) before the service exists.
3. **This doc supersedes two sections of `docs/gc-dashboard-design.md`**, updated alongside this
   doc: "`project_subcontractors` is a roster, never an authorization source" (its prediction that
   writing `(project_id, owner_company_id)` would let "a future GC-owned/multi-sub model and the
   roster read one table" was half right — the roster *does* become load-bearing, but re-keyed to
   `jobsite_id`, so those rows are 8d-g's backfill *input*, not directly reused, and
   `project_subcontractors` itself is dropped in 8d-h) and "Explicitly not resolved here"'s GC-owned
   jobsite / email-invite bullets (now built, here).
4. **`docs/gc-dashboard-design.md`'s standing role-gate gap is fixed for free.** "Neither the GC
   dashboard nor the join-code endpoints picked up a role gate; any signed-in user in a GC company
   can still see the dashboard and its join code." 8d-c/8d-d add `requireRole(...MANAGER_ROLES)` on
   every jobsite write. Retrofitting the same gate onto today's `GET /api/companies/join-code` is
   cheap (one line) and can land in the same pass as 8d-c, but is a distinct decision from this doc
   — noted, not applied here.

## Landing order

1. This design doc (8d-a).
2. Schema (8d-b): `jobsites`, `jobsite_subcontractors`, `projects.jobsite_id` — SQL and docs only.
3. Server GC-side jobsite CRUD (8d-c), including the `jobsiteGrouping.js` rename.
4. Server invites, both accept cases, and the admission gate (8d-d) — the bulk of the new server
   work, and the step that makes the roster load-bearing.
5. Client GC-side jobsite UI (8d-e), including removing `ProjectForm.tsx`'s dead `isGc` branch.
6. Client sub-side accept + project picker/cache passthrough (8d-f).
7. Migration/backfill of Phase 6 join-code links (8d-g) — after the new model is proven against new
   data.
8. Retire the fuzzy grouping, drop `project_subcontractors`, docs and the two-account manual smoke
   (8d-h) — the only irreversible step, done last.
