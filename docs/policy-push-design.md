# Top-Down Corporate Policy Push Design (Phase 9e)

Status: **decided**. Covers the "Top-down corporate policy push" promised to GC Portfolio
(`docs/pricing-and-positioning-strategy_V2.md`: "enables top-down corporate topic distribution" /
"Push Required Safety Topic to All Active Sites"). Full plan:
`~/.claude/plans/let-s-work-on-9e-quizzical-newell.md`. See `docs/tasks.md` 9e and
`docs/pricing-promise-gaps.md` (row "Portfolio — top-down policy push," previously `Missing`) for
how this was tracked before it was built.

## Scope

One **current required topic** per GC company, applied live across every active, non-archived
jobsite on the GC's portfolio — including a jobsite added or reactivated after the push, since
this reads the company's current state at request time rather than snapshotting a jobsite list.
No per-jobsite selection: a GC picks one topic and it goes out to every active site at once,
matching the pricing copy's "all active sites simultaneously" promise exactly. A GC clears or
replaces the pushed topic manually; there is no auto-expiry or scheduling (see "Known v1
limitations").

This is a **soft nudge, never a block**: a foreman on an in-scope project sees a banner and the
required talk pinned/badged in the meeting wizard's talk picker, but can still log any talk. A
hard block was explicitly rejected — it would risk the exact failure mode (a talk not getting
logged at all) the whole product exists to prevent.

## Gating: GC Portfolio only, writes further limited to managers

`getPlanId(company.companyType, company.tier) === "gc-portfolio"` (`gc:premium` or
`gc:enterprise`), enforced server-side by `siteScopeService.assertPolicyPushAvailable` — a new
function in `server/services/siteScope.js` that mirrors `assertSiteRolesAvailable`/
`assertScorecardsAvailable`'s exact shape (a 403 `PLAN_LIMIT`). Every read and write below calls
it first.

The two write endpoints (push, clear) are additionally gated to `admin`/`safety_manager`
(`requireRole(...MANAGER_ROLES)`, `server/constants/roles.js`) at the router level — a
company-wide action, not a site one, so `superintendent` is deliberately excluded (unlike
`SITE_MANAGER_ROLES`, which admits a superintendent for jobsite-scoped actions like inviting a
sub). The read endpoint has no role gate beyond company membership: any GC member, including a
site-scoped superintendent (narrowed to their assigned jobsites via `allowedJobsiteIds`), may see
the current push and compliance rollup.

Client: the "Policy Push" nav link and page are **always visible to every GC**, regardless of
plan — the same "selling point" convention `gc-subcontractors` and the Defense Bundle button use.
A non-Portfolio GC sees `PolicyPushUpgradeNotice` in place of real data instead of the page being
hidden. Within the page, the push/clear controls are further hidden from a non-manager (mirroring
the server's `requireRole` split) — a site-scoped superintendent sees the current push and
compliance rollup read-only. The server remains the real authority throughout.

## Data model

Three nullable columns directly on `companies` (`Supabase_SQL.sql`, declared after the
`toolbox_talks` and `users` tables since it references both):

```sql
required_talk_id UUID REFERENCES toolbox_talks(id) ON DELETE SET NULL,
required_talk_pushed_at TIMESTAMPTZ,
required_talk_pushed_by UUID REFERENCES users(id) ON DELETE SET NULL,
```

This is singleton "current state" per GC company (0 or 1 value, ever) — the same shape as the
existing `logo_path` column — not a dedicated table. The locked decisions explicitly rule out
per-jobsite rows or a history requirement, so a table that would only ever hold 0–1 row per GC
adds a join for no benefit. An append-only audit trail of past pushes is deliberately **deferred,
not built**: it would be cheap to add later (an insert-only log written from the same
`pushRequiredTopic`/`clearRequiredTopic` call sites), but nothing in this build consumes it — see
"Known v1 limitations."

## Why the picker only offers global talks

`server/services/talks.js` gained `listGlobal()` — every `toolbox_talks` row with
`is_global = true` — as the picker's data source, deliberately not a reuse of `listForCompany`
(whose visibility filter unions in the caller's *own* company's custom talks). A subcontractor's
own `listForCompany` call only ever returns global talks plus *its own* company's custom talks
(`server/services/talks.js`), so a GC pushing one of its own custom talks would be invisible to
every sub it's pushed to — a silent, undebuggable failure. `pushRequiredTopic` re-validates this
server-side (a direct `toolbox_talks` query filtered to `is_global = true`, 404 otherwise) rather
than trusting the client to only ever submit a picker option. A GC authoring shared content that
its subs *can* see is a materially bigger feature (cross-company talk visibility) — that's the
still-open "Company safety form and manual builder" backlog item, not this one.

## Compliance model

`server/services/policyPush.js`'s `getComplianceRollup` reuses the existing, **unmodified**
`server/utility/compliance.js` `computeCompliance` directly, with a single open-ended
since-pushed-at window per jobsite (`{ start: pushedAt, end: today }`) — it does **not** reach for
`subScorecard.js`'s per-day rolling machinery (`docs/sub-scorecard-design.md`), which exists to
solve a different problem (a 30-day *rate*, needing daily granularity and join-date proration).
This feature only needs one boolean per sub — "has anyone logged the required talk since it was
pushed, up to today" — which is exactly `computeCompliance`'s existing single-window contract once
the caller pre-filters logs by `talk_id` and picks `pushedAt` as the window's `start`. A new, small
`listCompletedLogsForTalkSince(projectIds, talkId, since)` query does that filtering; it is
deliberately not a change to `gcDashboard.js`'s shared, already-tested `listCompletedLogsInWindow`
(which selects no `talk_id` column and is reused unmodified by both `getOverview` and
`scorecards.js`) — adding a talk filter there would change a shared caller's contract for this one
caller.

No active push short-circuits `getComplianceRollup` to an empty `{ jobsites: [], totals }` shape
with zero further queries — there's nothing to roll up against. No locked-sub masking is needed:
same reasoning `docs/sub-scorecard-design.md` documented, every sub reaching this feature is
already unlocked (`gc:premium`/`gc:enterprise` both have `unlockedSubs: null`).

## Endpoint contract

Same conventions as `docs/gc-dashboard-design.md`'s table: `requireAuth → loadUserContext →
requireGcCompany`, camelCase, a resource outside the caller's authorization is a 404, never a 403
— existence is never leaked to an unauthorized caller.

| Endpoint | Returns |
| --- | --- |
| `GET /api/gc/policy-push?date&tzOffset` | The caller's current push (or nulls if none) plus, when one is active, a per-active-jobsite compliance rollup since it was pushed. 403 `PLAN_LIMIT` unless GC Portfolio. |
| `GET /api/gc/policy-push/talks` | Every `is_global = true` talk, for the picker. 403 `PLAN_LIMIT` unless GC Portfolio. |
| `POST /api/gc/policy-push` `{ talkId }` | Pushes/replaces the current topic across every active jobsite. 404 if `talkId` isn't a global talk. 403 `PLAN_LIMIT` unless Portfolio; 403 unless `admin`/`safety_manager`. |
| `DELETE /api/gc/policy-push` | Clears the current topic. Same gating as the push above. Idempotent when nothing is currently pushed. |
| `GET /api/projects/:id/required-topic` | The caller's own project's current required topic (nulls if the project is unlinked, its jobsite is inactive/archived, or the linked GC has nothing pushed). 404 if the project isn't the caller's own. **No plan gate** — see below. |

The sub-facing read deliberately has no plan check: it reflects whatever is currently stored on
the linked GC's row regardless of the GC's *current* plan. If a GC downgrades off Portfolio after
pushing a topic, that pushed topic keeps showing to its subs (and would count toward what the
compliance rollup shows, if the GC could still read it) until the GC re-upgrades to clear or
replace it — both writes are gated on `assertPolicyPushAvailable`. This is consistent with how
every other Portfolio-only feature in this codebase behaves on downgrade (data isn't retroactively
hidden), not a new kind of bug.

## Client UX

**GC side** (`/gc/policy-push`, reached from the Navbar): `CurrentPushCard` shows the pushed
topic's title, when it was pushed, and by whom, or an empty state. A manager (`admin`/
`safety_manager`) additionally sees `PushTopicForm` (a `Select` populated from the picker endpoint
plus a "Push to all active sites" button) and, once a topic is active, `ClearPushButton` — both
wrapped in a `ConfirmDialog` since this is a broad, company-wide action, the same precedent an
archive/delete flow uses. Once a topic is active, every GC member (including a read-only
superintendent) sees `PolicyComplianceTable`, a card list (not an HTML `<table>` — no table
primitive exists in this codebase) of every active jobsite's roster and each sub's Logged/Missing
status against the pushed topic.

**Foreman side**, in the meeting wizard's talk step: `RequiredTopicBanner` reads the selected
project's required topic (`GET /api/projects/:id/required-topic`) and shows "Your GC requires
this topic: {title}" when one exists — purely decorative, rendering nothing on loading, error,
offline, or when nothing is pushed. `content-library/TalkList.tsx` gained an optional
`requiredTalkId` prop: when the required talk is present in the (already trade/search/custom-
filtered) list, it's sorted to the front and shown with a "Required by your GC" badge and a
highlighted card border. If the required talk isn't in the currently-filtered list, it simply
doesn't show — acceptable, since this is a nudge, not enforcement. Neither surface ever blocks
picking a different talk.

## Known v1 limitations

- **No auto-expiry or rotation.** A pushed topic stays current until a manager replaces or clears
  it by hand — no "this week's topic" scheduling concept exists anywhere in this codebase yet.
- **No per-jobsite override.** One topic goes to every active jobsite at once; a GC can't push a
  different topic to different sites. Matches the pricing copy's promise exactly, but is worth
  revisiting if a large, varied portfolio wants site-specific requirements.
- **No audit trail of past pushes.** Only the current push is stored; replacing or clearing it
  discards the prior state. Cheap to add later (an insert-only log) if a GC ever wants "what did
  we require last quarter."
- **A downgraded-off-Portfolio GC's already-pushed topic keeps showing to subs** (and would still
  count toward a compliance view the GC itself can no longer read) until the GC re-upgrades to
  clear or replace it. Consistent with every other Portfolio-only feature's downgrade behavior in
  this codebase.
- **The sub-facing read does zero plan-checking by design** (see "Endpoint contract" above) — this
  is intentional, not an oversight, but is worth re-stating since every other endpoint in this
  feature is plan-gated.
- **The `ON DELETE SET NULL` degrade paths are ops-only.** A global talk can't be deleted via the
  app's own talk CRUD today (custom-talk `remove` is scoped to non-global rows only), so
  `required_talk_id` losing its reference only happens via a direct database operation — untested
  in practice, but the degrade-to-null-title behavior (`getCurrentPush`/
  `getRequiredTopicForProject`) is there for that case regardless.
