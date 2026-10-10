# In-House Subcontractors Design (proposed Phase 13)

Status: **decided** — open questions resolved with the maintainer; no code written yet. Covers how a GC that self-performs trades
(e.g. "Hyperion" with its own framing and roofing crews) tracks those crews in the app, how the
crews join the GC's jobsites, who logs in as them, and how plans and limits treat them.

## Why this exists

Today a GC cannot be a subcontractor on its own jobsite:

- `companies.company_type` is `gc` or `subcontractor`, never both.
- Meeting logs hang off a sub's `projects` row; link/unlink and the invite/QR accept routes are all
  guarded by `requireSubcontractorCompany` (403 for a GC) — `docs/gc-dashboard-design.md`,
  `docs/jobsite-design.md` ("a GC cannot be a sub on another GC's jobsite in v1").

A GC with in-house crews has two bad options: sign the crew up as a second, unrelated company
(two accounts, a name that doesn't say it belongs to the GC, possibly a second bill), or not track
the crew's talks at all, so the compliance dashboard under-reports the GC's own site.

## Decisions

1. **An in-house crew is a real `companies` row with `company_type = 'subcontractor'`**, linked to
   its GC by a new nullable `parent_gc_company_id`. Named by the GC, e.g. "Hyperion - Framing".
   Rejected: a dual-type company (`company_type` becomes a set). Every `requireGcCompany` /
   `requireSubcontractorCompany` guard, `PLAN_LIMITS` key (`${companyType}:${tier}`) and the
   `check_join_code_gc_only` CHECK assume one type. A child company reuses all of it unchanged.
2. **One level deep.** A child cannot itself have children, and only a GC can be a parent.
3. **The crew joins the GC's jobsites through the existing roster** (`jobsite_subcontractors`) with
   a row inserted already accepted — no token, no email, no QR. The sub's `projects` row is created
   by the same `projectsService.create` path `acceptInvite` uses. Nothing downstream (dashboard,
   PDFs, cadence, nudges, `projects.gc_company_id` authorization) changes.
4. **Asked at onboarding, manageable later.** The GC is asked "Do you have in-house
   subcontractors?" once; the answer is skippable. Settings has a permanent "In-house crews"
   section for adding, renaming and archiving them.
5. **In-house crews inherit the GC's entitlements** and do not count against GC caps (see Plans).

## Data model

```sql
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS parent_gc_company_id UUID REFERENCES companies(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

ALTER TABLE companies
  ADD CONSTRAINT check_parent_gc_sub_only
  CHECK (parent_gc_company_id IS NULL OR company_type = 'subcontractor');

ALTER TABLE companies
  ADD CONSTRAINT check_parent_gc_not_self
  CHECK (parent_gc_company_id IS NULL OR parent_gc_company_id <> id);

CREATE INDEX IF NOT EXISTS companies_parent_gc_idx
  ON companies (parent_gc_company_id) WHERE parent_gc_company_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS companies_parent_gc_name_unique
  ON companies (parent_gc_company_id, lower(name)) WHERE parent_gc_company_id IS NOT NULL;
```

The runnable version (with the `CREATE TABLE` changes and commented `ALTER`s for an existing
database) is in `Supabase_SQL.sql`.

- `ON DELETE RESTRICT` (not CASCADE): deleting a GC must not silently wipe crews that own meeting
  logs. A GC with children has to remove or archive them first.
- "Parent is actually a GC" cannot be a CHECK (it spans two rows). It is enforced in the service
  layer, in the one function that sets the column, which always takes the parent from the caller's
  verified company, never from the request body.
- `archived_at` is new on `companies`; today only `projects` and `jobsites` have it. Archived =
  hidden from the roster picker and the Settings list, restorable. Needed because of decision 6.
- No new roster table and no change to `jobsites` / `jobsite_subcontractors` / `projects`.

Offline-sync rule (`CLAUDE.md`): `companies.id` for a child is **server-generated** — creating a
crew is an online, authenticated GC manager action, the same exemption `jobsites.id` and
`company_invites.id` already carry.

## Authorization

| Question | Check | New? |
| :--- | :--- | :--- |
| Can this user create / rename / archive an in-house crew? | `requireGcCompany` + `requireRole(...MANAGER_ROLES)`; the parent is `req.user.companyId` | New route, existing guards |
| Can this user act on this crew? | `companies.parent_gc_company_id = req.user.companyId` — single-column, same shape as `jobsites.gc_company_id` | New |
| Can a crew be attached to this jobsite? | `jobsites.gc_company_id = req.user.companyId` **and** crew's `parent_gc_company_id = req.user.companyId` | New, both single-column |
| Can a crew's foreman log a talk? | Unchanged: `projects.owner_company_id = req.user.companyId` | No |
| Can the GC read the crew's meetings / PDFs? | Unchanged: `projects.gc_company_id = req.user.companyId` | No |

A request for another GC's crew returns **404**, indistinguishable from a missing row (the
convention in `docs/jobsite-design.md`). The superintendent site scope (`docs/gc-roles-design.md`)
applies as it does for any sub: they see the crew's meetings only on sites they are assigned to;
attaching a crew to a site follows the same `allowedJobsiteIds` rule `createInvite` uses.

## Who logs in as the crew

`users.company_id` is a single column, so one person belongs to exactly one company. A foreman of
"Hyperion - Framing" is a `users` row in that child company, not in Hyperion.

- **Inviting people into a child.** Reuse `company_invites` unchanged: a row with
  `company_id = <child>`. The only change is *who may create it*: a manager of the parent GC is
  treated as a manager of its children. `POST /api/companies/in-house/:id/invite` checks
  `child.parent_gc_company_id = req.user.companyId` (via `companies.getOwnedCrew`) before calling
  `companyInvites.createInvite(childId, email, role)`. The invitee signs up through
  the existing 8c invite link and lands in the child company; no change to
  `createProfileFromInvite`.
- **Roles inside a child.** Same enum (`admin`, `safety_manager`, `foreman`). The GC's own people
  are not added to the child; GC managers reach child data through the GC dashboard.
- **A child with no users yet** is valid. It exists so the GC can attach it to jobsites and see
  "Hyperion - Framing — no talks logged" on the dashboard, which is the correct signal.
- **Open question — GC admin acting as the crew.** Letting a GC manager log a talk on behalf of a
  crew (switching "who am I") is out of scope: it needs a company-switcher and changes
  `meeting_logs.foreman_id` semantics. v1 requires the crew to have its own foreman users.

## Server design

- `server/services/inHouseCrews.js` (new): `listForGc(gcCompanyId)`, `create({ gcCompanyId, name })`,
  `rename`, `archive` / `restore`, `assertOwnedCrew(crewId, gcCompanyId)` (the 404 check above).
  Services never touch `req`/`res`; routes + controllers stay thin per `docs/folder-structure.md`.
- `create` inserts the `companies` row (`company_type: 'subcontractor'`, `parent_gc_company_id`,
  tier per Plans below), then **attaches the crew to the active jobsites the GC picked**
  (`jobsiteIds`; decision 3, revised: nothing is automatic), best-effort per site, logging failures — the same posture `acceptInvite` /
  `createProfileWithJobsiteInvite` take (a failed attach leaves a working crew that can be
  attached from the jobsite later).
- `jobsites.create` gains one step: after the jobsite row is written, attach the non-archived
  crews the GC picked (`crewIds`). A GC manager can remove a crew from a single site with the existing
  `DELETE /api/jobsites/:id/subcontractors/:subId`.
- `jobsites.attachInHouseCrew({ jobsiteId, crewId, gcCompanyId })` (new, shared by both callers):
  assert both ownership checks, insert the accepted roster row (`accepted_at = now()`, `token`
  and `invited_email` null), then `projectsService.create` with a server-generated id. Roster
  first, project second, same ordering and the same best-effort rollback as `acceptInvite`. A
  `23505` on `jobsite_subs_company_unique` means already attached → treated as success (idempotent).
- Endpoints (all `{ success, data }`, camelCase):

| Endpoint | Guard | Notes |
| :--- | :--- | :--- |
| `GET /api/companies/in-house` | `requireGcCompany` | The GC's crews incl. archived flag |
| `POST /api/companies/in-house` | `requireGcCompany`, `requireRole(...MANAGER_ROLES)` | `{ name }`; 409 on a duplicate name within this GC |
| `PATCH /api/companies/in-house/:id` | same | `name`, `archived` |
| `POST /api/jobsites/:id/in-house/:crewId` | `requireGcCompany`, `requireRole(...SITE_MANAGER_ROLES)` | Re-attach a crew removed from a site |

- Archive semantics (as built in 13b): archiving a crew excludes it from auto-attach and from
  `POST /api/jobsites/:id/in-house/:crewId` (409), but does **not** detach it from sites or stop its
  foremen logging talks, and restoring does **not** re-attach it (the GC may have removed it from a
  site on purpose). Delete (`DELETE /api/companies/in-house/:id`) is 409 once the crew has any meeting
  log or user. Hiding archived crews on the dashboard/roster is a client concern (13e).
- Name uniqueness: a partial unique index is not possible on a name alone (`companies.name` is
  not unique today — two unrelated subs may both be "Acme Roofing"). Uniqueness is enforced
  per-parent in the service (`parent_gc_company_id` + case-insensitive name) with a matching
  `CREATE UNIQUE INDEX ... (parent_gc_company_id, lower(name)) WHERE parent_gc_company_id IS NOT NULL`.

## Plans and limits

The crews are the GC's own labour, not customers, so charging for them would feel punitive. Three
places currently see a crew as just another sub and each needs a rule.

1. **GC Free `unlockedSubs: 1`** (`subLocking.computeUnlockedSubIds`). Without a change, a Free GC
   with three crews would see two of them locked (name, status and PDFs hidden). Rule: an
   in-house crew is **always unlocked and never uses a slot**, exactly how a Site-Pro-sponsored sub
   is already treated (`sponsored` entries). Implementation: the roster entry gets
   `inHouse = (companies.parent_gc_company_id = gcCompanyId)` and the pure function treats
   `sponsored || inHouse` as unlocked. A small, pure, easily unit-tested change.
2. **The crew's own plan** (`PLAN_LIMITS["subcontractor:<tier>"]`: seats, history, library,
   branding). **Derive, don't store** — the precedent is `hasSiteProAccess`, which is "derived,
   never stored, so a Portfolio ending needs nothing un-written." A crew's effective tier is its
   parent's mapped to the sub ladder: GC Free (`basic`) → Trade Free (`basic`), GC Portfolio
   (`premium`/`enterprise`) → Trade Pro (`premium`; never Trade Enterprise, which carries
   integrations and the 100/month AI allowance).

   **Audit result (confirmed).** The effective tier is already resolved in exactly one function,
   `resolveEffectiveTier` (`server/services/sponsorship.js`), called from exactly two places:
   `companiesService.getById` (feeds `seats`, `jobsites.assertJobsiteAvailable`, `siteScope`,
   `branding`, PDF generation) and `usersService.getUserContext` (feeds `req.user.tier`, i.e.
   `loadUserContext`, the talks/favorites/meeting-log/integration controllers and
   `/api/users/me`). Every other `companies(tier)` embed (`jobsites.js`, `sponsorship.js`,
   `smsNudges.js`, `jobsiteIntegrations.js`) reads the *GC's* tier, which is already the right
   one. `stripeWebhook.js`/`stripePlans.js` only *write* `companies.tier`. So the change is one
   function plus selecting `parent_gc_company_id` (and the parent's `tier`) in the two queries —
   no `getLimits(...)` call site changes.

   **Relationship to existing sponsorship.** `isSponsored` already lifts a Free sub to Pro when it
   holds an accepted roster row on a live Site Pro / Portfolio-GC jobsite. Because crews are
   attached to the GC's sites, that rule already gives a Portfolio GC's crew Trade Pro *while it
   is attached to a live site*. The explicit parent rule exists so that does not depend on
   attachment: a crew with no active site (new, or all removed/archived) still inherits, and the
   behaviour reads as "your plan covers your crews" rather than an accident of the roster. The
   precedence is: parent-derived tier first, then the existing sponsorship rule for any crew that
   still resolves to `basic`. On a GC Free company with one Site Pro site, a crew attached to that
   site resolves to Pro through sponsorship — consistent with how every sub on that site behaves.

   Rejected: copying the parent's tier onto the child and syncing it from the Stripe webhook.
   It works but creates a drift surface (webhook retries, a GC downgrading while a child is
   mid-write) that a derived value doesn't have.
3. **Seats** (`seats.assertSeatAvailable`). Trade Free counts every member as one seat total, so
   a crew on a Free GC would hold exactly one user. That is a real limit for a framing crew with
   several foremen. **Decided: accept it.** The cap is the Free plan's whole point, and upgrading
   to Portfolio lifts it. A higher fixed cap for crews on GC Free would invent a plan tier the
   pricing page doesn't describe (`docs/pricing-promise-gaps.md` exists precisely to avoid new
   unadvertised promises). Revisit if onboarding shows it blocking real GCs. The invite UI should
   show the existing `PLAN_LIMIT` error with an upgrade prompt, as `JobsiteForm` does.
4. **Billing.** A child never has a Stripe customer or subscription (`stripe_customer_id`,
   `stripe_subscription_id` stay `NULL`). `POST /api/stripe/checkout-session` and the portal are
   already scoped to the caller's company; add a 403 for a company with `parent_gc_company_id`
   ("billing is managed by your general contractor"), and hide the Billing section in Settings.

## Client design

- **Onboarding prompt.** After first GC signup (and shown once on an existing GC's next visit
  to the dashboard when no crews exist and the prompt hasn't been dismissed), a card: "Does your
  company have in-house subcontractors?" → *Yes, add them* / *Not now*. Dismissal is a per-viewer
  convenience, kept in `localStorage` (wrapped in try/catch per project convention); it is not
  business state and nothing breaks if it is lost. Yes opens the crew form. As built, the card
  title is "Does your company have its own crews?" with a longer explanation (every crew is
  added to all job sites, shows on the dashboard with an In-house badge, doesn't use a free
  subcontractor slot, foremen are invited by email) and a pointer to Settings → In-house crews.
- **Crew form.** One text input (name) with an "Add another" affordance, `font-size: 16px`,
  ≥ 48×48px targets, React Hook Form + Zod `onTouched`. A suggested-name row of one-tap chips
  (Framing, Roofing, Concrete, Electrical, Plumbing, Drywall) minimises typing with gloves on;
  tapping fills "`{GC name} - {Trade}`". An **Other** chip fills "`{GC name} - `" and focuses
  the input so a trade that isn't listed can be typed; the name is always editable, and a bare
  trailing dash is rejected. Mutations are wrapped in domain hooks (`useInHouseCrews`,
  `useInHouseCrewActions`), not inline `useMutation`.
- **Settings → In-house crews** (GC only): list, rename, archive/restore, "Invite someone"
  per crew (reusing the existing invite form with `companyId`). Hidden for subcontractors.
- **GC dashboard.** Roster rows and compliance rows for a crew show an **In-house** badge
  (`$`-prefixed transient prop, theme tokens only). Nothing else changes — they are subs.
- **Jobsite roster.** On a site, crews appear in the roster like any sub; removal uses the
  existing control. A "Add in-house crew" action lists crews not yet on the site.
- Styling follows `docs/ui-styling.md` (styled-components, `props.theme`, no inline styles);
  new components get tests meeting the repo's 100% jsdom coverage threshold.

## Crew join link (13f-join)

Email invites need the GC to know each foreman's email. The join link removes that: each crew can
have **one open link and QR** that a foreman opens, then signs up with their own email, name and
password. They land in that crew as a **foreman**. Built as an extension of the existing signup
path, not a new flow.

- **Joins immediately, no GC approval.** Same trade-off the job site QR makes
  (`docs/jobsite-qr-join-design.md`). The controls are the limits below and a **Remove** button per
  person.
- **Limits.** 7 days (the invite TTL) and 10 people, fixed in `server/services/crewJoinLinks.js`.
  A new link replaces the old one (new token, count back to 0, so the old URL stops working);
  **Turn off** deletes it. One row per crew: `crew_join_links` with `UNIQUE (company_id)`.
- **Role is always `foreman`**, set in `users.createProfileFromCrewJoin`, never read from the
  client. Admin and Safety Director still come through email invites. The Trade Free one-seat cap
  still applies (`seats.assertSeatAvailable`, PLAN_LIMIT message).
- **Head count is race-safe without a stored procedure.** `claimSlot` is a compare-and-set on the
  `uses` value it just read; a lost race is a 409 "try again". The spot is taken before the `users`
  row is written and handed back if that write fails.
- **Sign-up only.** One person belongs to one company, so a signed-in visitor is asked to sign out.
  The join page is `/crew-join/:token`; the signup carries `crewJoinToken` as `user_metadata`
  (`requireProfileMetadata` adds it as a fourth mutually-exclusive token kind).
- **Invalid, expired, full, archived crew and "no longer a crew" are one 404**, like every
  lookup-by-secret here. The token is shown only to a manager of the crew's GC, inside the URL.
- **Remove a person** (`DELETE /api/companies/in-house/:id/members/:userId`). Deletes their `users`
  row and their Supabase Auth account. Without the auth delete they could use the sign-up data
  left on their account to rejoin through the deferred `createProfile` while the link is live.
  Sealed logs and PDFs stay; `meeting_logs.foreman_id` is `ON DELETE SET NULL`, so those logs
  lose the name link. Their favorites go (cascade). The confirm dialog says so.
- **UI.** Settings, In-house crews, **People & link** on each crew: the people with Remove, and
  the link with a client-rendered QR (`qrcode`), Copy, Download, Make a new link, Turn off.

Not built: revoking a pending email invite from the UI, admin or safety director through the link,
configurable limits, an approval queue.

## Edge cases

| Case | Behaviour |
| :--- | :--- |
| Crew name collides with an existing real company | Allowed; the unique index is per parent only. The crew is never shown to other GCs. |
| GC downgrades Portfolio → Free | Crews stay; their derived tier drops to Trade Free (seat/history limits apply, existing data is kept — same as a sub downgrading today). |
| Crew has meeting logs and the GC wants it gone | Delete is **blocked** (409); archive instead. History and PDFs must stay for the compliance record. A crew with no logs and no users may be hard-deleted. |
| A crew foreman signs up with the same email as a GC user | Existing rule applies: one company per user. `createProfileFromInvite` already handles an email that has a profile (reject). Surface the existing message. |
| GC deletes a jobsite | Roster rows cascade; the crew company is untouched. |
| Sub-led project already exists for the crew name | No special handling; the crew's `projects` rows come only from `attachInHouseCrew`. |
| Join-code / QR flow | Unchanged. A crew is never admitted through it (they are attached directly); `requireSubcontractorCompany` still passes for a crew, which is correct if the GC wants to use QR for its own foremen. |

## Out of scope (v1)

- A company-switcher or "act as crew" for GC managers.
- Nested crews (a crew with its own sub-crews) or crews owned by a subcontractor.
- Moving an existing, independently registered company under a GC (merge/adopt). Needs a consent
  flow from the company's admin; track separately if GCs ask.
- Per-crew billing or seat add-ons.
- Configurable join link expiry or head count; a GC approval queue for join link signups.
- Procore / integration push for crews (they use the GC's integrations, if any, through the normal
  jobsite push; no crew-specific configuration).

## Sequencing

Each step ships with tests; server tests are plain CommonJS Vitest per `CLAUDE.md`.

1. **Schema + docs.** `Supabase_SQL.sql` DDL above, `Supabase_Schema.md` rows, this doc finalised
   with the open questions answered.
2. **Server core.** `inHouseCrews` service + routes; `attachInHouseCrew`; `jobsites.create` hook.
3. **Plans.** `subLocking` in-house exemption; extend `resolveEffectiveTier` with the parent rule
   (select `parent_gc_company_id` + parent `tier` in `companies.getById` and
   `users.getUserContext`); Stripe 403 for children; seat messaging.
4. **Invites into a child.** Parent-manager permission on `company_invites`.
5. **Client.** `apiInHouseCrews` + `useInHouseCrews`, onboarding card, crew form, Settings section,
   dashboard/roster badge.
6. **Docs + pricing copy.** `docs/pricing-promise-gaps.md` and, if desired, a line on the GC
   pricing cards ("Track your own crews at no extra cost").

## Resolved questions

1. **Crew seats on GC Free** — accept Trade Free's one-seat cap (Plans §3).
2. **Derived vs mirrored tier** — derived; the entitlement-reader audit is done and recorded in
   Plans §2 (one function, two call sites).
3. **Which sites a crew joins** — the GC chooses. Revised after build: auto-attaching every crew
   to every site put a crew on sites that never needed its trade, where it showed as "missing" and
   counted against compliance. The crew form lists the GC's live sites pre-ticked (one tap in the
   common case, untick the rest) and the job site form lists the active crews pre-ticked the same
   way. The API attaches nothing unless ids are sent. Remove per site, or add later from the
   roster, as before.
4. **Existing GCs** — see the prompt once **and** find the feature in Settings. Dismissal is
   remembered per viewer in `localStorage`, so a different device or a cleared browser may show
   it again; that is acceptable for a one-time nudge, and the Settings section is always there.
