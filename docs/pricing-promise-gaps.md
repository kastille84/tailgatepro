# Pricing-promise gaps

Audit of what the public pricing and landing pages promise versus what the code actually delivers.
Tracked as **Phase 9** in `docs/tasks.md`. Audit date: 2026-09-24.

Sources audited: `client/src/data/plans.ts` (`SUB_PLANS`, `GC_PLANS`), `client/src/pages/Pricing/Pricing.tsx`
(FAQ + "zero seat tax" callout), `client/src/pages/Landing/*` (`ComparisonTable`, `GcSection`, `HowItWorks`,
`LandingFaq`, `CompliancePdfCard`, `GcDashboardMockup`), and `docs/pricing-and-positioning-strategy_V2.md`.
Status was judged from the code, not from `docs/tasks.md` claims.

**Re-running the audit:** re-check each row below against the code (grep the evidence paths), update the
Status column, and tick the matching Phase 9 checkbox. Re-run before any public launch or after any edit to
`plans.ts` / the landing copy.

Status legend: **Implemented** · **Partial** (exists but weaker than the copy) · **Missing** (copy only).
Resolution legend: **Build** (a Phase 9 item), **Reword** (fix the copy), **Defer** (blocked, e.g. on billing).

**Update (9a shipped):** every **Reword** resolution below is done. Unbuilt paid features stay on the pricing
cards with a "Coming soon" tag (`comingSoon` in `client/src/data/plans.ts`); landing/FAQ claims for GPS,
tamper-evidence, QR, AI, 500+ and 10+ languages were reworded or removed. SMS nudges stay a selling point,
tagged "Coming soon" on the landing page and pricing cards. The **Build**
and **Defer** items are unchanged and remain open in Phase 9b–9g. "Can't be back-dated" was also removed: the
server accepts a client `held_at` up to 7 days in the past (`server/utility/heldAt.js`).

**Update (9e Defense Bundle shipped):** the "coming soon" tag was dropped from the "1-click OSHA Defense
Bundle" pricing-card bullet and the landing comparison table now shows it without the suffix — see the GC
Site Pro row below and `docs/osha-defense-bundle-design.md`.

**Update (9e scorecards shipped):** the "coming soon" tag was dropped from GC Portfolio's "Cross-project
subcontractor safety scorecards" pricing-card bullet (kept in `features`) and the matching Pricing FAQ line
was reworded so only "top-down corporate policy push" is still flagged coming soon — see the Portfolio row
below and `docs/sub-scorecard-design.md`.

**Update (9e policy push shipped):** the "coming soon" tag was dropped from GC Portfolio's "Top-down
corporate policy push across all sites" pricing-card bullet (kept in `features`) and the Pricing FAQ line
was reworded to describe the shipped feature instead of flagging it coming soon — see the Portfolio row
below and `docs/policy-push-design.md`.

**Update (form builder deferred):** GC Portfolio's "Custom company safety form & manual builder" bullet was
reworded to "Custom company safety talks shared with every sub" (what shipped) and its `comingSoon` entry was
removed. The free-form form builder and structured manual builder are deferred, not promised: they overlap
heavily with Procore Forms/Inspections/Incidents and SafetyCulture, and depend on the Procore integration
decision (Phase 9f). The parked design is in `docs/company-talks-design.md` ("Deferred: form builder").

**Update (manual upload dropped):** Trade Enterprise's "Custom safety manual upload" bullet was removed from
`plans.ts` (both `features` and `comingSoon`) and the strategy doc. A standalone document upload is commodity
file storage that overlaps Procore Documents/SharePoint/Drive, and its job (using a company's own safety content)
is already served by custom talks. Revisit only if a customer asks for policy acknowledgment tied to a talk.

**Update (9e QR jobsite join shipped):** the two QR rows below flipped from Reword-only (9a removed the
claims) to actually **Implemented** — a new per-jobsite `jobsites.join_token` (standing, no expiry) plus a
client-rendered QR code (`JobsiteJoinQrCard.tsx`, the `qrcode` package) and a public `/jobsite-join/:token`
page. Self-service, no GC approval, available on every jobsite regardless of plan — see
`docs/jobsite-qr-join-design.md`. Code complete; manual verify pending. No pricing/landing copy was changed
by this update — reintroducing the QR wording on the Pricing FAQ/GcSection/HowItWorks pages is a separate,
deliberate copy decision, not made here.

## Tier-gating fact base

- `server/utility/entitlements.js` has exactly two gates, `hasTranslationAccess` and `hasBrandingAccess`, both
  reading `["premium", "enterprise"]`. The client mirrors them in `client/src/hooks/useCurrentUser.ts` (UI only).
- The `subscription_tier` enum is `basic | premium | enterprise` (`Supabase_SQL.sql`). It does not map to the plan
  names on the pricing page (Trade Free/Pro/Enterprise, GC Free/Site Pro/Portfolio). There is no GC tier value.
- Signup hardcodes `tier: "basic"` (`server/services/users.js`). Nobody can reach a paid tier except by editing
  the row in the database. Stripe/billing is deferred and `/api/stripe` is commented out in `server.js`.
- **Update (9b):** the plan is now resolved from `tier` + `company_type` (`PLAN_LIMITS` in
  `entitlements.js`); GC Site Pro is per jobsite (`jobsites.plan`). Limits are defined and returned by
  `/api/users/me` but not yet enforced (9c/9d).
- There is **no quantity limit anywhere**: no foreman cap, no jobsite cap, no talk cap, no history window, no
  retention rule.

## Subcontractor plans

| Promise | Status | Evidence | Gap | Resolution |
|---|---|---|---|---|
| Trade Free — 1 user account | Implemented (9c) | `server/services/seats.js`, `companyInvites.js`, `users.js` | Free counts every role, so the signup admin is the one seat; enforced on invite and on accept. No dedicated upgrade UI (toast only) | — |
| Trade Free — full offline PWA | Implemented | `client/src/service-worker.ts`, `client/src/utils/db/*`, `*ReplayHandler.ts` | Real-device airplane-mode pass still owed (see tasks Phase 3) | — |
| Trade Free — 30 core OSHA templates | Done (9c) | 30 talks flagged `is_core` (`scripts/lib/talkRow.js` `CORE_TALK_SLUGS`); `server/services/talks.js` hides the rest from Trade Free | — | Built (9c); Free sees 30 of ~112 global talks, upgrade banner in `ContentLibrary.tsx` |
| Trade Free — digital signatures + photo proof | Implemented | `signature-pad`, `SignaturesStep.tsx`, `PhotoCapture.tsx`, `server/services/signatures.js` | — | — |
| Trade Free — auto-email PDF to GCs | Implemented | `pdfGenerationQueue.js`, `email.js` | Sends only when a GC admin or `gc_contact_email` exists; logs instead of sending if Mailgun is unset | — |
| Trade Free — 30-day in-app history | Implemented (9c) | `meetingLogs.listForCompany` / `getMeeting` / `getPdfUrl` apply `historyDays`; `MeetingHistory.tsx` shows the hidden-count banner | — | — |
| Trade Free — app watermark | Implemented | `pdfGeneration.js` (footer line for non-premium tiers) | A text footer, not an overlay; no "Claim your free GC portal" CTA (strategy doc §7) | 9g |
| Trade Pro — up to 8 foremen | Implemented (9c) | as above | Counts foreman-role users + pending foreman invites; admins/safety managers are free | — |
| Trade Pro — 5-year legal archive | Implemented (9c) | `MeetingHistory.tsx` (`/meetings`), `archiveYears` in `PLAN_LIMITS`; nothing is ever purged | Retention is a policy guarantee (5 yrs, crew photos follow their meeting), not a purge job | — |
| Trade Pro — 1-click OSHA Defense Bundle (ZIP) | Implemented | `services/meetingLogs.js` `getDefenseBundleEntries`, `services/zipBundle.js`, `GET /api/meetings/defense-bundle` | Every completed log the company has ever logged, across every project/GC, plus an `index.csv` (labeled by GC/client, not by the caller's own company); gated on `archiveYears > 0` (Trade Pro/Enterprise). Landed alongside this row rather than being audited as a pre-existing gap — see `docs/sub-defense-bundle-design.md` | — |
| Trade Pro — custom logo, no watermark | Implemented | `companies.js` controller, `pdfGeneration.js`, `LogoUpload.tsx` | — | — |
| Trade Pro — 500+ OSHA library | Missing | 34 global talks | ~7% of the claim; licensing question at tasks.md 1749-1754 | Reword (9a) + Build (9e) |
| Trade Pro — AI Talk Builder | Missing | Only manual authoring (`TalkForm.tsx`) | No LLM code; see tasks.md 1736-1741 | Reword (9a) + Build (9e) |
| Trade Pro — AI multi-language audio, 10+ languages | Partial | `translation.js` (Google Translate, custom talks only), `useTalkAudio.ts` (browser `speechSynthesis`) | Not AI voice; depends on device voices; language count unverified; global library not translated | Reword (9a) |
| Enterprise — unlimited foremen | Implemented (9c) | `PLAN_LIMITS` `foremanSeats: null` | No cap applied | — |
| Enterprise — custom safety manual upload | Dropped (2026-09-28) | Only logo/photo/signature uploads exist | No document upload path, by decision: commodity file storage overlapping Procore/existing document tools; custom talks cover the "our own content" job | Dropped; copy removed from `plans.ts` and the strategy doc |
| Enterprise — Procore, JobTread, QuickBooks sync | Missing | No code | Copy only | Defer (9f) |
| Enterprise — multi-crew scheduling, equipment check-ins | Dropped (2026-09-29) | No schedule/equipment tables | Scheduling and equipment inspection are workforce-management scope, not toolbox-talk compliance — overlaps dedicated tools (Rhumbix/busybusy, Procore Inspections) | Dropped; copy removed from `plans.ts` and the strategy doc |

## General contractor plans

| Promise | Status | Evidence | Gap | Resolution |
|---|---|---|---|---|
| GC Free — 1 active jobsite | Implemented (9d) | `jobsites.js` `assertJobsiteAvailable` on `create` and re-activation | Counts live sites; +1 per live Site Pro site; 403 `PLAN_LIMIT` + inline upgrade prompt | — |
| GC Free — dashboard inbox for sub PDFs | Partial | `gcDashboard.js`, `features/gc-dashboard/*` | A per-sub meeting list with signed PDF links, capped at 200 (`MEETINGS_LIST_LIMIT`); not an "inbox"; ungated | Reword (9a) |
| GC Free — basic sub roster overview | Partial | `JobsiteList.tsx`, `SubComplianceRow.tsx` | Exists, ungated for every GC | — |
| GC Free — 1 sub unlocked, others blurred | Implemented (9d) | `utility/subLocking.js`, `services/subAccess.js`, `gcDashboard.js`, `SubComplianceRow.tsx` | Earliest-accepted sub (plus Site Pro subs) unlocked; locked subs are placeholders server-side and 403 on direct meeting/PDF calls | — |
| Site Pro — sponsor unlimited subs on one site | Partial (9d) | `services/sponsorship.js`, `jobsites.plan` | A sub on a live `site_pro` jobsite resolves as Trade Pro; enforced, but no billing can set `jobsites.plan` yet, so still tagged "coming soon" | Defer (9f) |
| Site Pro — SMS nudges, Mondays 7:00 AM | Missing | Only cron in `server.js` is a leftover 5am job | No SMS provider, phone storage or scheduler | Build (9e) |
| Site Pro — Procore & Autodesk ACC sync | Missing | No code | Copy only | Defer (9f) |
| Site Pro — 1-click OSHA Defense Bundle (ZIP) | Implemented (9e) | `services/gcDashboard.js` `getDefenseBundleEntries`, `services/zipBundle.js`, `GET /api/gc/jobsites/:id/defense-bundle` | Streams every completed log's PDF for one jobsite plus an `index.csv`, gated on `jobsites.plan === "site_pro"`; Portfolio's separate "Portfolio-Wide Search" version is unbuilt | — |
| Portfolio — cross-project scorecards | Implemented (9e) | `services/scorecards.js`, `utility/subScorecard.js`, `utility/rollingWindow.js`, `GET /api/gc/subcontractors[/:companyId/scorecard]` | Rolling 30-day daily-compliance-rate score per sub, averaged across every jobsite that sub has with the GC, with a per-jobsite breakdown; archived jobsites excluded from scoring (see `docs/sub-scorecard-design.md`) | — |
| Portfolio — top-down policy push | Implemented (9e) | `services/policyPush.js`, three new `companies` columns (`required_talk_id`/`required_talk_pushed_at`/`required_talk_pushed_by`), `GET/POST/DELETE /api/gc/policy-push`, `GET /api/projects/:id/required-topic` | One current required topic per GC, pushed live across every active jobsite; a soft nudge in the meeting wizard (never blocks logging a different talk); manual clear/replace only, no auto-expiry (see `docs/policy-push-design.md`) | — |
| Portfolio — Superintendent vs Safety Director roles | Implemented (9d-2) | `server/constants/roles.js` (`superintendent`, `SITE_MANAGER_ROLES`), `services/siteScope.js`, `services/jobsiteMembers.js`, `JobsiteMembersModal.tsx` | `superintendent` is scoped to its assigned jobsites via `jobsite_members` (dashboard/meetings/PDF/roster all 404 outside scope); `safety_manager` relabeled "Safety Director"; Portfolio-only, 403 `PLAN_LIMIT` otherwise. Run the `Supabase_SQL.sql` ALTERs before relying on this in prod | — |
| Portfolio — custom company safety talks (was "form/manual builder") | Implemented (9e), reworded | `services/talkVisibility.js`, `talks.js` `visibilityFilter`, `subAccess.listAcceptedGcIds`, `entitlements.canAuthorCompanyTalks`, `/gc/talks` | GC-authored company talks shared with every sub on the GC's active jobsites (and pushable via policy push). The form builder and manual builder are deferred and no longer promised (see `docs/company-talks-design.md`) | Resolved: copy reworded, builders deferred |
| Portfolio — 10 sites vs unlimited | Implemented (9d) | `effectiveJobsiteLimit` via `assertJobsiteAvailable` | Cap 10 (premium) / unlimited (enterprise); no billing sets the tier yet | — |

## FAQ, callout and landing claims

| Claim | Where | Status | Gap | Resolution |
|---|---|---|---|---|
| Scan a QR code or tap a link to open the app | Pricing FAQ, HowItWorks | Implemented (9e) | `GET /api/jobsites/:id/join-link`, `JobsiteJoinQrCard.tsx` (client-rendered via `qrcode`), `/jobsite-join/:token`. Manual verify pending — see `docs/jobsite-qr-join-design.md` | — |
| Project-specific QR codes/links for GC sponsorship | Pricing FAQ, GcSection | Implemented (9e) | A new per-jobsite `jobsites.join_token` (standing, no expiry) — self-service join, no GC approval, available on every jobsite regardless of plan; the company-wide `join_code` and per-jobsite email invites are unchanged, additive paths. Manual verify pending | — |
| "Every subcontractor gets full access for $0" | Pricing callout | Partial (9d) | Enforced via effective tier (see Site Pro row); unbuyable until billing, copy still says coming soon | Defer (9f) |
| "Emailed PDFs stay in your inbox forever" | Pricing FAQ | Partial, misleading | The email carries a signed link expiring after 30 days (`EMAIL_PDF_URL_TTL_SECONDS`), not an attachment | Resolved: copy reworded (9a); a GC can re-open an expired link via the in-app report page (9c) |
| "Tamper-evident signatures" / tamper-evident PDF | Pricing hero, ComparisonTable | Implemented (9e) | An HMAC-SHA256 content seal (server-only secret) is computed atomically at completion, stored on `meeting_logs.content_seal`, printed on the PDF footer, and independently recomputable via `GET /api/meetings/:id/verify-seal` (sub) and the GC-side equivalent — closing the "no hash/HMAC/seal" gap; a `meeting_log_audit_events` trail records created/completed/pdf_generated/seal_verified. See `docs/tamper-evidence-design.md`. Known v1 gap: signature/crew-photo image bytes aren't hashed, only their DB paths | — |
| "GPS-verified" PDF seal | ComparisonTable, HowItWorks; `pricing-and-positioning-strategy_V2.md` | Resolved (dropped) | No GPS capture in client, server or SQL, and none is planned — a field crew's location isn't core to the OSHA-record use case and raises privacy/consent questions this product doesn't need to take on. The live landing/pricing copy already carried no GPS claim (9a); the strategy doc's aspirational wording is now reworded too (9e) | Reword (done) |
| "Can't be back-dated" | Landing | Partial | `held_at` plumbing exists (`utility/heldAt.js`); server clamping not verified | Verify (9a) |
| Auto-SMS nudges every Monday | GcSection | Missing | See above | Reword (9a) |
| "AI topic generator" / "generate a custom hazard talk" | ComparisonTable, HowItWorks | Missing | No AI generation | Reword (9a) |
| "500+ OSHA talks" | ComparisonTable | Missing | 34 talks | Reword (9a) |
| "30-second field start", "rollout 1-4 weeks" | ComparisonTable | Unverifiable | Not measured anywhere | Reword (9a) |
| Flat per-site pricing / no seat fees | Pricing | Missing | Display only; no billing | Defer |
| Text + AI audio in 10+ languages | ComparisonTable | Partial | See the Trade Pro row | Reword (9a) |

Note: the "45 seconds" claim appears only in `docs/pricing-and-positioning-strategy_V2.md` (lines 16, 33, 55,
197), never in client copy. It must stay out of marketing.

## Strategy-doc items not in `plans.ts` and not built

From `docs/pricing-and-positioning-strategy_V2.md`:

- §5: permanent history retention for GC Site Pro/Portfolio; "Custom Company Form Builder" on Trade Pro
  (deliberately dropped: the form builder is deferred, see the update above); Procore/ACC as a Trade Pro add-on; SMS "All Sites" and Procore/ACC
  "Multi-Project Routing" on Portfolio; Defense Bundle "Portfolio-Wide Search".
- §2: smart tagging (trade, phase, equipment, natural-language search), QR pass and roster check-in, SOC-2 and
  cryptographic timestamping.
- §6: every conversion-trigger modal (2nd foreman, 30-day lockout, watermark trap, non-English audio prompt,
  sub #2 blur, SMS upsell, the 4th-site "$447 vs $499" prompt, policy-push prompt, scorecard prompt). Only the
  Trade Pro non-English upsell note and the PDF watermark exist.
- §7: PDF footer CTA "Claim Your Free GC Portal" (the shipped watermark reads "Logged via TailgatePro (Free
  plan)" with no CTA).

## What is delivered today

Offline PWA; signatures and crew photo; auto-email of the PDF link to the GC; free-tier PDF watermark; Pro/Enterprise
logo branding; Pro/Enterprise translation of custom talks (text); GC dashboard with roster and signed PDF links;
jobsite invites and the company join code.

## Related existing entries (not duplicated in Phase 9)

`docs/tasks.md`: Defense Bundle (~1158), tier-gating deferral (~1296, ~1664), AI Talk Builder / cloud voice
(~1736-1741), 500+ library licensing (~1749-1754), crew-photo retention (~762-768), Stripe billing and Procore
(Deferred).
