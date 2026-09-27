# GC Roles Design (Phase 9d-2)

Status: **draft for review** — no code written yet. Covers the Superintendent role for GC Portfolio, per-site
scoping, and how both are enforced. Task: `docs/tasks.md` 9d-2. Pricing promise: "Multi-manager roles —
Superintendent vs Safety Director" (`client/src/data/plans.ts`, `docs/pricing-promise-gaps.md`).

## Why this exists

Today `user_role` is `admin | safety_manager | foreman` (`server/constants/roles.js`) and the two manager roles
are identical: every manager sees every jobsite, and can create/archive sites and invite people. A GC Portfolio
customer with many sites wants a site superintendent to see only their own site, without company-wide powers.

## Decisions (confirmed with the maintainer)

1. **Superintendent is site-scoped; Safety Director stays company-wide.** "Safety Director" is a display label
   for the existing `safety_manager` value — no DB rename, no migration of existing users.
2. **Scoping uses a new `jobsite_members` table** (`jobsite_id`, `user_id`). Superintendents see only assigned
   sites; `admin` / `safety_manager` are unrestricted.
3. **GC Portfolio only.** GC Free and Site Pro keep today's behavior; inviting or assigning a superintendent
   returns 403 `PLAN_LIMIT` (same shape as `assertJobsiteAvailable`).
4. **Site assignment happens after the person joins** (not at invite time). The invite carries only the role;
   a new superintendent sees no sites until a manager assigns them (the empty state must say so).

## Permission matrix

| Action | admin | safety_manager (Safety Director) | superintendent |
| --- | --- | --- | --- |
| View GC overview / meetings / PDFs | all sites | all sites | assigned sites only |
| View jobsites + roster | all | all | assigned only |
| Invite / remove subs on a site | yes | yes | assigned sites only |
| Create / archive / restore a jobsite | yes | yes | no |
| Invite teammates, assign site members | yes | yes | no |

Out-of-scope resources return **404**, not 403, so a superintendent can't probe which ids exist.

## Data model

```sql
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'superintendent';  -- cannot run inside a transaction block

CREATE TABLE jobsite_members (
  jobsite_id UUID NOT NULL REFERENCES jobsites(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (jobsite_id, user_id)
);
ALTER TABLE jobsite_members ENABLE ROW LEVEL SECURITY;  -- server-only, no policies
```

The composite key means no client-generated UUID is needed: this is an online, authenticated GC action and never
an offline write (same exemption as `jobsites.id`).

### `jobsite_members` vs `company_invites`

They answer different questions and are not merged:

| | `company_invites` | `jobsite_members` |
| --- | --- | --- |
| Question | "May this email join the company, at what role?" | "Which sites can this user see?" |
| Key | company + email (no user exists yet) | jobsite + user (user must exist) |
| Lifetime | Temporary; deleted on accept | Permanent until unassigned |
| Holds | token, expiry, role | just the link |

`company_invites` is unchanged. Because a `user_id` doesn't exist until the invite is accepted, site assignment is
a separate, later step (decision 4).

## Server design

- `server/constants/roles.js`: add `superintendent` to `ROLE_LABELS`; relabel `safety_manager` "Safety Director";
  add `SITE_MANAGER_ROLES` (`admin`, `safety_manager`, `superintendent`) for site-level routes. `MANAGER_ROLES`
  stays company-level, so every existing `requireRole(...MANAGER_ROLES)` gate (create/archive/invites) excludes
  superintendents with no further change.
- New `server/services/siteScope.js`: `getAllowedJobsiteIds(user)` returns `null` (unrestricted) for
  admin/safety_manager, else the assigned jobsite ids. One query per request, like `subAccess.getUnlockedSubIds`.
- Apply the scope at the existing `gc_company_id` choke points:
  `gcDashboard.js` (`listLinkedProjects`, `assertGcLinkedProject`, `listActiveJobsites`, `listMeetings`,
  `getOverview`) and `jobsites.js` (`listForGc`, `getOwnedJobsite`, `createInvite`, `removeSubcontractor`).
  Routes for invite/remove sub switch to `SITE_MANAGER_ROLES`; scope is enforced in the service.
- Plan gate: `companyInvites.createInvite` and the new members endpoint reject `superintendent` unless the GC
  company is on Portfolio (reuse the 9b entitlement helpers in `server/utility/entitlements.js`).
- New manager-only endpoints: `GET/PUT /api/jobsites/:id/members`.

## Client design

- Invite-role dropdown offers "Superintendent" on Portfolio; otherwise the inline `/pricing` upgrade prompt
  (same pattern as `JobsiteForm`'s `PlanLimitError`).
- Site-members assignment on the jobsite, through a domain hook wrapping `useQuery`/`useMutation`.
- Hide create/archive/team-invite controls for superintendents. The dashboard needs no change: the server scopes
  the data.
- Drop "coming soon" from the pricing copy only after this ships.

## Resolved questions

1. **Seats — decided: no seat cost.** `assertSeatAvailable` counts only foremen on Pro/Enterprise and everyone on
   Free, and GC plans have no seat cap, so a superintendent consumes no seat. No change to `seats.js`.
2. **Lapsed Portfolio — decided: keep the rows, deny access until re-upgrade.** Nothing leaks and nothing is
   deleted. Enforced by treating a superintendent on a non-Portfolio GC company as having no allowed sites
   (`getAllowedJobsiteIds` gets the plan check when the scoped services are wired in step 3).
3. **Removing a user** already cascades their `jobsite_members` rows; no extra work.

## Sequencing

1. Design doc review (this file).
2. SQL + roles constants + `siteScope` (with tests).
3. Scope the GC dashboard and jobsite services (with tests).
4. Members endpoints + Portfolio gate.
5. Client: invite dropdown, members UI, hidden controls, pricing copy.
