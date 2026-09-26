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
tamper-evidence, QR, AI, 500+ and 10+ languages were reworded or removed. SMS nudges and the Defense Bundle stay
as selling points, tagged "Coming soon" on the landing page and pricing cards. The **Build**
and **Defer** items are unchanged and remain open in Phase 9b–9g. "Can't be back-dated" was also removed: the
server accepts a client `held_at` up to 7 days in the past (`server/utility/heldAt.js`).

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
| Trade Pro — 5-year legal archive | Implemented (9c) | `MeetingHistory.tsx` (`/meetings`), `archiveYears` in `PLAN_LIMITS`; nothing is ever purged | Retention is a policy guarantee (5 yrs, crew photos follow their meeting), not a purge job; no export | — |
| Trade Pro — custom logo, no watermark | Implemented | `companies.js` controller, `pdfGeneration.js`, `LogoUpload.tsx` | — | — |
| Trade Pro — 500+ OSHA library | Missing | 34 global talks | ~7% of the claim; licensing question at tasks.md 1749-1754 | Reword (9a) + Build (9e) |
| Trade Pro — AI Talk Builder | Missing | Only manual authoring (`TalkForm.tsx`) | No LLM code; see tasks.md 1736-1741 | Reword (9a) + Build (9e) |
| Trade Pro — AI multi-language audio, 10+ languages | Partial | `translation.js` (Google Translate, custom talks only), `useTalkAudio.ts` (browser `speechSynthesis`) | Not AI voice; depends on device voices; language count unverified; global library not translated | Reword (9a) |
| Enterprise — unlimited foremen | Implemented (9c) | `PLAN_LIMITS` `foremanSeats: null` | No cap applied | — |
| Enterprise — custom safety manual upload | Missing | Only logo/photo/signature uploads exist | No document upload path | Build (9e) |
| Enterprise — Procore, JobTread, QuickBooks sync | Missing | No code | Copy only | Defer (9f) |
| Enterprise — multi-crew scheduling, equipment check-ins | Missing | No schedule/equipment tables | Not modelled | Build (9e) |

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
| Site Pro — 1-click OSHA Defense Bundle (ZIP) | Missing | Only a comment in `pdfFilename.js` | No zip dependency or route; see tasks.md 1158 | Build (9e) |
| Portfolio — cross-project scorecards | Partial | `/api/gc/overview`, `utility/compliance.js` | Single-day compliance view; no scoring or history | Build (9e) |
| Portfolio — top-down policy push | Missing | No code or schema | — | Build (9e) |
| Portfolio — Superintendent vs Safety Director roles | Missing | `server/constants/roles.js`: `admin`, `safety_manager`, `foreman` | No "superintendent"; both manager roles have identical permissions; no per-site scoping | Build (9d-2) |
| Portfolio — custom company safety form/manual builder | Missing | No code | — | Build (9e) |
| Portfolio — 10 sites vs unlimited | Implemented (9d) | `effectiveJobsiteLimit` via `assertJobsiteAvailable` | Cap 10 (premium) / unlimited (enterprise); no billing sets the tier yet | — |

## FAQ, callout and landing claims

| Claim | Where | Status | Gap | Resolution |
|---|---|---|---|---|
| Scan a QR code or tap a link to open the app | Pricing FAQ, HowItWorks | Partial | A link works (PWA URL); no QR generator in the repo | Build (9e) or Reword |
| Project-specific QR codes/links for GC sponsorship | Pricing FAQ, GcSection | Missing | Only a company-wide `join_code` and per-jobsite email invites exist; no QR | Build (9e) or Reword |
| "Every subcontractor gets full access for $0" | Pricing callout | Partial (9d) | Enforced via effective tier (see Site Pro row); unbuyable until billing, copy still says coming soon | Defer (9f) |
| "Emailed PDFs stay in your inbox forever" | Pricing FAQ | Partial, misleading | The email carries a signed link expiring after 30 days (`EMAIL_PDF_URL_TTL_SECONDS`), not an attachment | Resolved: copy reworded (9a); a GC can re-open an expired link via the in-app report page (9c) |
| "Tamper-evident signatures" / tamper-evident PDF | Pricing hero, ComparisonTable | Partial | App-level lock only; no hash/HMAC/seal/audit log; service-role writes bypass it | Build (9e) or Reword |
| "GPS-verified" PDF seal | ComparisonTable, `CompliancePdfCard.tsx:74`, HowItWorks | Missing | No GPS capture in client, server or SQL | Reword (9a) or Build (9e) |
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

- §5: permanent history retention for GC Site Pro/Portfolio; "Custom Company Form Builder" on Trade Pro (`plans.ts`
  lists it only under GC Portfolio); Procore/ACC as a Trade Pro add-on; SMS "All Sites" and Procore/ACC
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
