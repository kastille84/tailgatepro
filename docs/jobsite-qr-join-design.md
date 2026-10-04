# Jobsite QR Join Design (Phase 9e)

Status: **draft**, not yet built. Covers the QR-code jobsite join promised in the pricing copy
("project-specific QR codes and links... any trade subcontractor working on those sites scans the
code to record talks under the GC's dashboard at zero cost," `docs/pricing-and-positioning-strategy_V2.md:218`)
and tracked as `docs/tasks.md:2589` ("QR-code generation for jobsite invite / join-code links (no
generator exists), or drop the QR claims"). See `docs/pricing-promise-gaps.md` rows 109–110.

This extends `docs/jobsite-design.md` (Phase 8d), which built the real `jobsites` table, the
email-invite flow, and the company-wide join code. It does not reopen any of 8d's decisions; it
adds a third, new admission path alongside those two.

## Decisions locked before this doc (confirmed with the user)

1. **Self-service, no GC approval.** A sub that scans the code is on the roster immediately —
   accepted, not pending. The GC's existing visibility (the roster list) and existing removal
   (`DELETE /api/jobsites/:id/subcontractors/:subId`, already shipped in 8d) are the control, not a
   gate before joining. This matches how a leaked company join code already behaves today — nothing
   new to build for containment, just to reuse.
2. **Available on every jobsite, no plan gate.** Unlike the Defense Bundle or scorecards, this is
   not a paid-tier perk. No `entitlements`/`siteScope` gate is added for it.

## Why neither existing mechanism fits

| | Company join code | Email invite token | **This feature** |
|---|---|---|---|
| Scope | Whole GC company | One jobsite, one email | One jobsite, anyone |
| How a sub attaches | `findOrCreateJobsite` fuzzy-matches the sub's own project name — the exact mechanism behind the open "Project*A" vs "Project_A*" duplicate-jobsite gap (`docs/tasks.md:2309`) | Locked to `invited_email`, case-insensitive match against `req.userEmail` | Tied to a real `jobsites.id` directly — no name matching, no duplicates |
| Expiry | Never | 7 days | Never (see "Known v1 limitations") |
| Who can use it | Anyone who knows the code | Only the invited address | Anyone who can scan/open the link |

A QR built from either existing mechanism would either inherit the duplicate-jobsite bug (company
code) or 403 for everyone except one named email (invite token). This needs its own admission path,
shaped like a hybrid: **per-jobsite like the invite, standing/no-expiry like the join code.**

## Data model

Two additive columns, no new table, no change to `jobsites.origin` or existing roster rows.

```sql
ALTER TABLE jobsites ADD COLUMN IF NOT EXISTS join_token TEXT UNIQUE;
```

A standing, per-jobsite credential — the same role `companies.join_code` plays for the whole
company, generated lazily on first request via the identical race-safe
`.update(...).is("join_token", null)` trick `companies.getOrCreateJoinCode` already uses. Unlike
`join_code`'s short, human-typed alphabet (`server/utility/joinCode.js` — designed to be read off a
screen and typed back), this token is only ever scanned or tapped, never typed, so it reuses
`generateInviteToken()`'s 64-char hex shape (`server/utility/inviteToken.js`) — same generation
call, same `isHexadecimal().isLength({min:64,max:64})` route-param validator already written for
`/jobsites/invite/:token`. Living on `jobsites` (not `jobsite_subcontractors`) keeps it separate
from that table's per-row `token` column, which stays scoped to the email-invite lifecycle
(`NULL` once accepted) and is never touched by this feature.

```sql
ALTER TABLE jobsite_subcontractors ALTER COLUMN invited_email DROP NOT NULL;
```

The only schema change to the roster table. A QR-accepted row has no invited email at all — it's
inserted already-accepted (`sub_company_id` + `accepted_at` set at insert time, not stamped onto a
pre-existing pending row), with `invited_email: NULL`. This needs no matching change to the
`jobsite_subs_email_unique UNIQUE (jobsite_id, invited_email)` constraint: standard SQL treats every
NULL as distinct for uniqueness, so any number of QR-joined rows with `invited_email IS NULL` can
coexist per jobsite. The existing `jobsite_subs_company_unique` partial index (`(jobsite_id,
sub_company_id) WHERE sub_company_id IS NOT NULL`) is what actually guards against the same company
joining twice — already shipped in 8d, reused unchanged.

**Run both `ALTER TABLE` statements in Supabase before deploying** — same operational note 9b/9d/9e
left for `jobsites.origin`/`plan`.

## Server

`server/services/jobsites.js` gains three functions, each closely mirroring an existing one in the
same file:

- **`getOrCreateJoinToken(jobsiteId, gcCompanyId, allowedJobsiteIds)`** — `getOwnedJobsite` first
  (same ownership/site-scope check `createInvite` already runs), then read-or-generate the token via
  the race-safe update-where-null pattern. Returns the raw token; the controller builds the full URL
  the same way `inviteSubcontractor`'s controller builds `acceptUrl`
  (`envUtils.keysBasedOnEnv().clientUrl` + path), so the service stays URL-agnostic like the rest of
  this file.
- **`previewJoinToken(token)`** — looks up `jobsites` directly by `join_token` (`select id, name,
  gc_company_id, companies(name)`), the same shape as `companies.getByJoinCode`, not
  `getActiveInvite` — there's no `expires_at` to check and no email to return. A missing token is a
  404, same minimal-disclosure rule as every other lookup-by-secret in this codebase.
- **`acceptJoinToken({ token, companyId })`** — resolves the jobsite via `previewJoinToken`, then
  **inserts** a new `jobsite_subcontractors` row (`sub_company_id: companyId, accepted_at: now(),
  invited_email: null, token: null, expires_at: null`) — an insert, not `acceptInvite`'s
  update-a-pending-row, since there is no pending row to update. On a `23505` conflict (the
  `jobsite_subs_company_unique` index — this company already has an accepted membership on this
  jobsite), **do not throw**: re-scanning a poster is ordinary behavior, not an error state, unlike
  re-accepting an email invite. Treat it as an idempotent no-op success. On success (fresh or
  idempotent), call `projectsService.create({ id: uuidv4(), ownerCompanyId: companyId, name:
  jobsite.name, jobsiteId })` exactly as `acceptInvite` does — reused verbatim, including its
  `resolveAdmission` check inside `projects.js`, which now passes because the roster row was stamped
  first. On a project-create failure, roll back by **deleting** the just-inserted roster row (not
  reverting fields, since there was nothing to revert to) — same best-effort, logged, non-fatal
  rollback `acceptInvite` already does.

No changes to `removeSubcontractor`, `toJobsiteWithRoster`, or the roster's client shape: a
QR-joined row is an ordinary accepted roster row with `email: null` (from `invited_email`), which
`JobsiteRosterModal.tsx`'s existing `subLabel` (`sub.companyName ?? sub.email`) and conditional meta
line already render correctly with no client change — `companyName` comes from the `companies(name)`
join on `sub_company_id`, never from `invited_email`. Locking (`isSubLocked`/GC Free's one-unlocked-
sub cap) applies identically regardless of admission path, also with no change.

### Routes

| Endpoint | Guard | Notes |
| :--- | :--- | :--- |
| `GET /api/jobsites/:id/join-link` | `requireGcCompany`, `requireRole(...SITE_MANAGER_ROLES)` | Same role set as the invite route — a site-scoped superintendent can pull the poster for their own jobsite. Returns `{ joinUrl }`, generating the token on first call. |
| `GET /api/jobsites/join/:token` | Public, no `requireAuth` — the token is the credential | `{ gcCompanyName, jobsiteName }`. 404 if the token doesn't resolve. |
| `POST /api/jobsites/join/:token/accept` | `requireAuth`, `loadUserContext`, `requireSubcontractorCompany`, `requireRole(...MANAGER_ROLES)` | No email check (there is none to check) — otherwise the same manager-only gate `acceptInvite` uses, since this still binds the whole company to a GC's site. |

Unlike the invite token, **`join_token` is deliberately returned to the browser** — the whole point
is for it to be publicly displayed on a screen or a printed poster. This is not a change in trust
model from `companies.join_code`, which is already shown in plain text on `JoinCodeCard.tsx` for
anyone with dashboard access to read and copy.

### Signup path for a sub with no account yet (Case B, extended)

Mirrors `docs/jobsite-design.md`'s Case B for the email invite, reusing the same two extension
points rather than inventing a fourth flow:

- **`requireProfileMetadata.js`** gains a third recognized key, `jobsiteJoinToken`, validated with
  the *same* requirement shape as the existing `jobsiteInviteToken` branch (`name` and `companyName`
  required, `companyType` forced to `"subcontractor"` regardless of what metadata claims). All three
  token keys (`inviteToken`, `jobsiteInviteToken`, `jobsiteJoinToken`) stay mutually exclusive —
  more than one present is a `422`.
- **`usersService.createProfile`** gains `createProfileWithJobsiteJoin`, a near-copy of
  `createProfileWithJobsiteInvite`: create the `companies` + `users` row first (founder becomes
  `admin`), **then** call `jobsitesService.acceptJoinToken` as the last step — best-effort, logged,
  never throrws past profile creation, so a failed accept still leaves a working account (recoverable
  by opening the same QR link again while signed in, which now runs the ordinary signed-in accept
  branch).
- `AuthProvider`'s existing background `createProfile()` safety net covers the deferred
  confirm-email case for free, same as it already does for both existing token kinds.

## Client

**GC side** (`features/jobsites/JobsiteRosterModal.tsx`, `canManage`-gated like the existing invite
form): a new `JobsiteJoinQrCard.tsx` sits alongside `InviteSubcontractorForm`. `useJobsiteJoinLink.ts`
(mirrors `useJoinCode.ts`) fetches/creates `{ joinUrl }`. The card renders the QR client-side with
`qrcode` (new dependency — see below), plus a "Copy link" button (same clipboard-with-fallback
pattern `JoinCodeCard.tsx` already uses) and a "Download QR" button that renders the code to a
canvas, turns it into a PNG blob, and reuses the existing `utils/triggerBrowserDownload.ts` (built
for the Defense Bundle ZIP, generic enough for any binary download) — covers the "print a poster for
the job trailer" scenario without a new download utility.

**Sub side**: new public page `pages/JoinJobsite/JoinJobsite.tsx` at route `/jobsite-join/:token`
(outside `RequireAuth`, wired in `App.tsx` next to the existing `/jobsite-invite/:token`), closely
structured after `AcceptJobsiteInvite.tsx` but simpler — no invited-email preview or mismatch state,
since nothing is email-locked:

- **Loading / invalid token**: same shape as the invite page's equivalent states.
- **Signed in, subcontractor manager**: one-click "Join this job site" button → `POST
  /api/jobsites/join/:token/accept` → navigate to `/projects`.
- **Signed in, wrong role or a GC account**: the same blocker copy pattern (`"Only an admin or
  safety manager can join a job site for your company"` / `"General contractor accounts can't join
  another contractor's job site"`), reworded for "join" instead of "accept."
- **Signed out**: "Already on TailgatePro? Sign in to join" → `navigate("/login", { state: { from:
  location.pathname } })`, reusing `Login.tsx`'s existing `state.from` redirect-back (already built
  for this exact purpose) — no client change needed there. A "New to TailgatePro?" button reveals an
  inline signup form (own RHF + Zod, copied from `AcceptJobsiteInvite.tsx`'s signup block) that calls
  `signUpWithEmail` with `user_metadata.jobsiteJoinToken` set, then `createProfile`, then navigates to
  `/projects` — the client-side mirror of the server's Case B extension above.

New hooks: `useJoinLinkPreview.ts` (mirrors `useJobsiteInvitePreview.ts`), `useAcceptJoinLink.ts`
(mirrors `useAcceptJobsiteInvite.ts`). `apiJobsites.ts` gains `getJoinLink`, `previewJoinLink`,
`acceptJoinLink`. `interfaces/jobsite.ts` gains `JobsiteJoinLink { joinUrl: string }` and
`JobsiteJoinPreview { gcCompanyName: string | null; jobsiteName: string | null }`.

### New dependency: `qrcode`

No QR generator exists in this repo today. `qrcode` (MIT, pure JS, no native/browser API
dependencies, renders to canvas or SVG) is the standard choice — flagging per `CLAUDE.md`'s "do not
add major dependencies without approval" rule, same as `archiver` was flagged when the Defense
Bundle ZIP shipped. Client-side generation (not a third-party QR image API) keeps the join URL from
being sent to an external service and works with this repo's offline-capable PWA posture.

## Worked example

1. A GC superintendent opens the roster modal for "Riverside Tower" and clicks "Show QR code."
   `getOrCreateJoinLink` generates `jobsites.join_token` on first use and returns a URL; the card
   renders it as a QR and offers Copy/Download. They print it and post it in the job trailer.
2. A new sub foreman, never on TailgatePro, scans it on their phone. Safari (or the installed PWA,
   see "Known v1 limitations") opens `/jobsite-join/:token`, previews "Turner Construction — Riverside
   Tower," and they tap "New to TailgatePro?" to sign up as Acme Roofing's admin.
3. On confirmed signup, `createProfileWithJobsiteJoin` creates Acme's company/admin, then accepts the
   join token — stamping the roster row and creating Acme's `projects` row against Riverside Tower in
   the same step Case A would.
4. The superintendent's roster now shows "Acme Roofing — Accepted" without having typed an email or
   sent an invite. If the QR photo circulates further than intended, the superintendent sees every
   new joiner on the same roster and can remove one with the existing "Remove" button.

## Known v1 limitations

- **No rotation or revocation of the token itself.** Symmetric with `companies.join_code`, which
  also never expires and has no regenerate endpoint today. If a token needs to be invalidated, the
  only lever in v1 is removing the offending sub after the fact via the existing roster "Remove"
  button — acceptable per the user's own framing of this feature (visibility + removal, not
  prevention). A rotate-token endpoint would be a small, clearly-scoped follow-up if this turns out
  to be needed in practice.
- **No audience restriction.** Anyone who can open the link joins as whatever subcontractor company
  they sign in as or create — there's no invited email, no approval step, and no way to restrict it
  to "people the GC actually expects." This is the explicit trade-off behind "self-service, no
  approval."
- **Installed-PWA scan behavior unverified.** Whether scanning opens the installed home-screen PWA
  (carrying the existing session/offline cache) or a fresh Safari/Chrome tab is untested in this
  codebase — flagged for manual verification before shipping, since it changes how smooth the "poster
  in the trailer" scenario actually feels.
- **No jobsite-scoped QR for an archived jobsite's continued use.** Scanning a token for an archived
  jobsite isn't explicitly designed here; the simplest v1 behavior is to let `previewJoinToken` 404
  the same way an invalid token does, since an archived jobsite shouldn't be gaining new subs.
  Confirm this against `PATCH /api/jobsites/:id`'s existing archive semantics before implementing.

## Explicitly not resolved here

**QR pass / roster check-in** (worker-level sign-in scanning, distinct from company-level jobsite
joining) — a different feature named in `docs/pricing-and-positioning-strategy_V2.md` §2, out of
scope for this doc.

**Reconciling this with the open duplicate-jobsite item** (`docs/tasks.md:2309`). This feature makes
the problem *smaller* going forward (a QR-joined sub always attaches to the real jobsite id, never a
name match), but does nothing for jobsites that already diverged via the company join code — that
remains a separate, undecided GC-side merge tool.
