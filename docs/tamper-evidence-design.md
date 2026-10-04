# Tamper-Evidence Design (Phase 9e)

**Status: shipped.** Closes `docs/pricing-promise-gaps.md`'s "Tamper-evident
signatures" row (previously **Partial** — an app-level lock only, "no
hash/HMAC/seal/audit log," "service-role writes bypass it") and its
"GPS-verified" row (resolved by dropping the claim, not building it — see
"Scope" below). Tracked in `docs/tasks.md` Phase 9e. Implementation plan:
`~/.claude/plans/let-s-work-on-the-expressive-wadler.md`.

## Scope

- An HMAC-SHA256 content seal over each meeting log's immutable-post-completion
  fields plus its signatures, computed once at completion.
- A `meeting_log_audit_events` table recording lifecycle events (`created`,
  `completed`, `pdf_generated`, `seal_verified`).
- A verify endpoint, sub-side and GC-side, that recomputes and compares.
- A small "Sealed / Verified / Tampered" UI affordance on the existing
  meeting-row components (`MonthMeetings.tsx`, `SubMeetingsModal.tsx`).

**Not in scope for v1** (see "Known v1 limitations" below): GPS capture,
third-party/RFC-3161 timestamping, hashing signature image bytes or the crew
photo's bytes (only their DB-referenced paths/ids are covered), backfilling a
seal onto meetings completed before this shipped, and any admin UI for
browsing the audit log (write-only in v1).

**GPS decision:** the pricing-promise-gaps audit flagged "GPS-verified" as
entirely missing — no capture code anywhere, and the live landing/pricing
copy had already been softened away from that specific wording before this
feature started (`CompliancePdfCard.tsx` says "Signed & Locked",
`ComparisonTable.tsx` says "Signed, timestamped PDF locked..."). Decision:
don't build GPS capture. A field crew's location isn't core evidence for "did
this crew hear this safety talk," and capturing it raises consent/privacy
questions this product doesn't need to take on for the win. The aspirational
`docs/pricing-and-positioning-strategy_V2.md` line was reworded to drop
"GPS-verified" instead.

## Gating: none — deliberately breaks the "every 9e feature is gated" pattern

Every other 9e feature gates a *distribution/aggregation* capability (Defense
Bundle downloads, cross-project scorecards, policy push) behind a paid tier.
Tamper-evidence is baseline record integrity, not a premium capability:
"Tamper-evident signatures" sits in the pricing **hero**, not a single plan's
feature row; HMAC-SHA256 is a zero-cost Node builtin (`crypto`), unlike the
metered APIs the existing `hasTranslationAccess`-style gates protect; and
gating "only paying customers get an unforgeable OSHA record" is a bad trust
posture for a safety-compliance product. Every plan gets the seal and the
verify affordance.

## Delivery: seal computed atomically inside `complete()`

The seal is computed and stored in the **same `UPDATE`** that stamps
`completed_at`/`held_at` in `server/services/meetingLogs.js`'s `complete()`
— not in the soft-fail `pdfGenerationQueue.js`. `complete()` already
documents this moment as what "locks the meeting_log and its signatures
against further changes"; sealing there means a completed meeting can never
exist unsealed. The PDF queue is soft-fail by design
(`docs/meeting-flow-design.md`) — if sealing happened there and failed
silently, the verify endpoint would 404 forever with no operator visibility.

**Alternative considered and rejected:** a plain SHA-256 hash with no secret.
Rejected because it doesn't close the "service-role writes bypass it" gap —
anyone with direct DB access could recompute a matching hash after editing a
row. An HMAC keyed by a server-only secret (`MEETING_LOG_SEAL_SECRET`, never
in the client, never stored alongside the seal) means a DB-only tamperer
can't forge a valid seal without also having the secret.

## Contents: the canonical HMAC payload

`server/utility/contentSeal.js`'s `buildCanonicalPayload` builds a
deterministic JSON string from:

```js
{
  id, projectId, talkId, companyId, foremanId, crewPhotoUrl, heldAt, completedAt,
  signatures: [ { id, workerName, quizScore, quizPassed }, ... ]  // sorted by id ascending
}
```

Signatures are sorted by `id` so DB row order never changes the payload.
Excludes `finalPdfUrl` (doesn't exist yet when `complete()` seals the row)
and image bytes — a signature/crew-photo blob swap at the same storage path
isn't detected by this v1 (see "Known v1 limitations"). `heldAt`/`completedAt`
are normalized through `new Date(value).toISOString()` before being embedded
— `complete()` passes a JS `Date#toISOString()` string, while every verify
path passes the same `TIMESTAMPTZ` column value round-tripped through
Postgres/PostgREST, which serializes the identical instant with different
lexical formatting (e.g. a `+00:00` offset instead of `Z`, or no fractional
digits when they're exactly zero). Without this normalization the HMAC would
never match on a real, untampered row — this was shipped as a bug, caught and
fixed post-launch; keep the normalization here if this function is ever
touched again. `computeSeal(payload)`
= `crypto.createHmac("sha256", secret).update(payload).digest("hex")`.
`sealsMatch(a, b)` uses `crypto.timingSafeEqual`. `shortSeal(seal)` = the
first 12 hex characters, uppercased, printed on the PDF footer as a
human-eyeballable (not self-verifying) receipt.

The audit trail (`server/services/auditLog.js`) is scoped to `meeting_logs`
lifecycle events only, not a general system-wide audit log, and is soft-fail
— an audit-insert failure never blocks the meeting-log operation it
describes.

## Endpoint contract

Same conventions as every other meeting/GC endpoint pair in this codebase
(`requireAuth`/`loadUserContext` scoping on the sub side, linked-project/
site-scope authorization on the GC side).

| Endpoint | Auth/scoping | Success | Errors |
| --- | --- | --- | --- |
| `GET /api/meetings/:id/verify-seal` | `requireAuth → loadUserContext`, scoped to caller's `company_id` | `{ success: true, data: { valid, sealedAt } }` | 404 "Meeting not found"; 404 "This meeting hasn't been sealed yet"; 502 on a DB read failure |
| `GET /api/gc/meetings/:id/verify-seal` | `requireAuth → loadUserContext → requireGcCompany`, scoped via linked-project/site-scope | same shape | same error set, scoped to GC linkage instead of ownership |

No `PLAN_LIMIT` case on either — no gate, per the decision above. Every call,
valid or tampered, records a `seal_verified` audit event.

## Client UX

`client/src/features/meeting-shared/SealBadge.tsx` — shared between the
sub's own Meeting History (`MonthMeetings.tsx`) and the GC dashboard's
(`SubMeetingsModal.tsx`), the two places a meeting row already shows a
PDF-related action. A neutral "Sealed" pill (local, no network call — purely
reflects whether the row has a seal at all) plus a "Verify" button that calls
the endpoint on click, mirroring `useMeetingPdfUrl`'s "fetch on click, not
per row" convention: a stale valid/tampered result sitting in the DOM
indefinitely would be misleading for a trust indicator. The verify mutation
is shared across a whole list (same as the existing PDF-URL hooks), so
`useVerifyMeetingSeal`/`useVerifyGcMeetingSeal` also expose `verifyingId`
(the last-targeted meeting id) — `SealBadge` only shows `result`/`isPending`
for the row that actually matches, so one row's "Verified" can never flash on
every other row. Once a result comes back, the button itself turns green
("Verified") or red ("Tampered", with a one-line explanatory note) and stays
clickable to re-check.

## Known v1 limitations

- **No backfill.** A meeting completed before this shipped has no seal — its
  row shows no badge at all, never a false claim either way.
- **No blob integrity.** Signature and crew-photo image bytes aren't hashed,
  only their DB-referenced storage paths/ids — a blob swapped in place at the
  same path wouldn't be caught.
- **The printed PDF fragment isn't self-verifying.** `shortSeal`'s 12
  characters on the footer are a human receipt, not a checksum the client
  validates alone — real verification always calls the endpoint, which
  recomputes the full digest server-side.
- **The audit log has no viewer UI yet.** `meeting_log_audit_events` is
  write-only in v1 — no admin/GC page reads it.
- **No GPS capture**, by decision (see "Scope").
