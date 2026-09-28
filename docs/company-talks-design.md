# Company Talks (GC-authored) Design (Phase 9e)

Status: **decided, v1 built**. First slice of the "Custom company safety form & manual builder" promised
to GC Portfolio (`client/src/data/plans.ts`, `docs/pricing-promise-gaps.md` row "Portfolio — custom
company safety form/manual builder"). Full plan: `~/.claude/plans/let-s-talk-about-the-noble-lollipop.md`.
See `docs/tasks.md` 9e.

## Scope

A GC on **GC Portfolio** authors *company talks* — ordinary toolbox talks (same shape and `TalkForm`
as a subcontractor's custom talk) that are visible to, and loggable by, every subcontractor working
for that GC. Policy push can push one of them as the required topic.

**Not built — deferred**: a free-form form builder (arbitrary fields, checklists, incident/near-miss
forms) and a structured manual builder. Both need a new schema, a renderer and PDF support, and overlap
heavily with Procore/SafetyCulture. The pricing bullet was reworded to "Custom company safety talks
shared with every sub" and its `comingSoon` tag removed, so nothing is promised. The parked design is at
the bottom of this doc ("Deferred: form builder").

## Why it needs no new tables

`toolbox_talks` already has `company_id` and `is_global`. A company talk is a row with
`is_global = false` and `company_id = <the GC>` — exactly what `talks.create` already writes. The
work is *visibility*, not storage. RLS is enabled with no policies (service-role only), so every
visibility rule lives in `server/services/talks.js`.

## Visibility rules

`visibilityFilter(companyId, fullLibrary, gcCompanyIds)` is the single source of truth (used by
`listForCompany` and `getById`). A caller sees:

1. global talks (core-only for Trade Free — Phase 9c),
2. its own company's talks,
3. **new:** talks whose `company_id` is in `gcCompanyIds` — the GCs the caller's company works for.

`gcCompanyIds` comes from `subAccess.listAcceptedGcIds(subCompanyId)`: distinct `gc_company_id`s
across the sub's `jobsite_subcontractors` rows with `accepted_at` set, on jobsites with
`archived_at IS NULL`. So access ends when the sub leaves a jobsite or the GC archives it; a pending
invite grants nothing. The GC branch is **not** narrowed by `is_core` (that flag only describes the
global library), so Trade Free subs see GC talks too.

`services/talkVisibility.resolveTalkVisibility(user)` bundles `{ fullLibrary, gcCompanyIds }` for the
controllers (`talks`, and `meetingLogs.createMeeting`'s talk check, which runs on every plan). A GC gets
`gcCompanyIds: []` — its own talks are already covered by rule 2.

PostgREST `or` filters can't hold a subquery, so the ids are resolved first and interpolated. They
are DB uuids, and `visibilityFilter` additionally only interpolates uuid-shaped values.

## Authoring and gating

- `canAuthorCompanyTalks(companyType, tier)` (`server/utility/entitlements.js`): every subcontractor
  plan (unchanged), but a GC needs `gc-portfolio`. `createTalk`/`updateTalk` return 403 "Upgrade to GC
  Portfolio to create company talks" otherwise. `remove` stays open to a downgraded GC (it can still
  delete). The client mirrors the flag in `useCurrentUser().canAuthorCompanyTalks` for UI only.
- **Role gate (GC only):** on top of the plan, a GC caller needs `admin`/`safety_manager`
  (`MANAGER_ROLES`) to create or edit — a company talk reaches every sub, so a superintendent or
  foreman shouldn't rewrite one. 403 "Only a safety director or admin can write company talks"
  (plan check runs first). Delete is manager-only for everyone via the route. Subcontractor roles are
  unchanged (any sub role can still author its own talks). Client mirror: `useCurrentUser().isManagerRole`.
- Route `GET/POST/PATCH/DELETE /api/talks` is unchanged; there was never a company-type check on it.
- Client: `/gc/talks` (behind `RequireGc`) renders the existing `ContentLibrary` page, with GC copy, an
  upgrade banner and no Add button for a non-Portfolio GC. Navbar entry "Company Talks".
- Update/remove are already scoped to `company_id = caller`, so a sub can never edit a GC's talk; the
  client also hides Edit on it (`features/content-library/talkOwnership.ts`) and badges it "From your GC".

## Policy push

The push picker now lists the global library plus the GC's own talks
(`policyPush.listPickerTalks(gcCompanyId)` = `talks.listForCompany`), and `pushRequiredTopic`
validates with `talks.getById(talkId, gcCompanyId)` (404 for any other company's talk). This
supersedes the old "global talks only" rule — see `docs/policy-push-design.md`. It works because a
sub's own visibility now includes the pushing GC's talks, so the wizard's required-topic banner
resolves the id against the sub's `useTalks` list.

## Edit lock

`assertNotLoggedAnywhere` makes a talk immutable once **any** meeting log references it (a log's
`talk_id` is a live FK, not a snapshot). A GC can therefore edit or delete its company talk freely
until the first sub logs it. To change a logged talk it creates a corrected copy. No versioning in v1.

**Lock hint.** `talks.listForCompany`/`getById` return `isLocked` (`findLoggedTalkIds`: one
`meeting_logs ... in(talk_id, ids)` query over the caller's *own* talks only — global and GC-shared
talks are never editable by the caller, so they're never "locked" and cost no query). `TalkDetail` hides
Edit for a locked own talk and shows "Used in a logged meeting, so it's read-only. To change it, create
a corrected copy." (`TalkForm`, which holds Delete, is only reachable via Edit.) `isLocked` is a hint
and can be stale (a log can land after the read, or an old Dexie-cached row lacks it); the server's 409
guard stays the authority.

## Known v1 limitations

- No audience targeting: every sub on an active jobsite of the GC sees every company talk.
- Logged talks are immutable, so fixing a typo means copying the talk.
- A sub's offline talk cache (Dexie `talksCache`) can keep a GC talk until its next online refresh
  after the sub is removed from the jobsite.
- A GC that downgrades off Portfolio keeps its existing talks visible to subs; only authoring is gated.
- Deleting a pushed company talk (never logged) silently clears the push (`ON DELETE SET NULL`).
- `meetingLogs.createMeeting` checks talk visibility for every plan (it used to check only Trade Free, so
  a paid sub could log any talk id that existed). A log created offline for a GC talk therefore 404s on
  flush if the sub's access ended in between (jobsite archived, sub removed) — same as Trade Free always did.
- Client `talkOwnership` is deliberately permissive while the caller's company id is unknown
  (loading/offline) so editing your own talks offline keeps working; the server is the authority.

## Deferred: form builder

Decided 2026-09-28: **not built, not promised.** Reasons: Procore (Forms, Inspections, Incidents,
Observations) and SafetyCulture already cover generic safety forms, a GC on Procore is unlikely to rebuild
its forms here, and a competing form engine muddies the planned Procore integration (Phase 9f). The
product's edge is sub-first toolbox talks (vetted library, quiz, signed and locked PDF, offline PWA). Revisit
after 9f or on real customer demand. If revisited, a cheaper option is 2-3 fixed-shape templates
(pre-task plan/JHA, near-miss, equipment checklist) with light customization instead of an arbitrary builder.

Design already worked out, so it isn't re-derived:

- **Storage:** a new `form_templates` table (`id` client UUID, `company_id`, `title`, `description`,
  `fields` JSONB, `requires_crew_signoff`, `version`). A filled-out form is a `meeting_logs` row with
  `kind = 'form'` (default `'talk'`), `form_template_id` (FK, `ON DELETE SET NULL`), `form_snapshot` JSONB
  and `responses` JSONB. Signatures, photos, the offline outbox, the PDF queue, the GC dashboard and the
  defense bundle are reused.
- **Snapshot:** the client sends the snapshot it actually rendered, and the server validates its shape and
  the responses against it. That is the audit record when a template is edited while a foreman is offline,
  and it removes the "logged = immutable" lock for forms (templates stay freely editable/deletable).
- **Fields:** `{ id (client UUID, stable across edits), type, label, helpText?, required, options? }`;
  types short/long text, number, date/time, single/multi-select, yes/no/N-A, section heading. Cap fields
  and options per template.
- **Gating:** GC Portfolio only, `admin`/`safety_manager` to author (same as company talks); every sub linked
  to the GC (`subAccess.listAcceptedGcIds`) can fill. Check form visibility for every plan, not just Trade Free.
- **Fill model:** one filer plus optional crew sign-off per template. The filer's signature satisfies
  `meetingLogs.complete()`'s at-least-one-signature rule.
- **Sync:** no new `SyncEntity`; the payload rides the existing `meeting_log` create, which fires at the end
  of the wizard. Template authoring online-only, with a Dexie cache for offline filling.
- **Compliance:** form logs must not count toward daily toolbox-talk compliance or scorecards (filter
  `kind = 'talk'` in `gcDashboard.listCompletedLogsInWindow`). Policy push is already `talk_id` based.
- **Consumers needing title fallbacks:** `gcDashboard.toMeetingSummary`/`getMeeting`,
  `getDefenseBundleEntries` and `utility/buildBundleIndex.js`, the sub-side bundle in
  `services/meetingLogs.js`, client `MonthMeetings.tsx` and `SubMeetingsModal.tsx` (otherwise "Untitled talk").
- **Wizard:** the talk step becomes a Talks | Forms pick, a `fill` step replaces `TalkPresenter`, the hard-coded
  "Step N of 6" eyebrows become derived, and `SignaturesStep` caps at one signer when crew sign-off isn't required.
