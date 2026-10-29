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

## PDF seal: file bytes, embedded images and the QR code

The content seal covers DB fields only, so a PDF edited in Acrobat, or a
signature image replaced in Storage, used to pass "Verify". Three additions
close that, without changing `content_seal` (already-sealed meetings keep
verifying):

- **Fingerprint at render time.** `pdfGenerationQueue.renderAndStore` hashes
  the rendered PDF (`pdf_sha256`) and every embedded blob (`blob_hashes`:
  `{ crewPhoto, signatures: { <id>: hash } }`, `null` where a download failed)
  and stores an HMAC over both (`pdf_seal`, domain-separated from
  `content_seal` via `contentSeal.computePdfSeal`). A PDF can't contain its
  own hash, hence columns on the row. Each render also records its `sha256` in
  its `pdf_generated` audit event, so an older emailed copy reads "superseded"
  after a regenerate rather than "no match".
- **Re-render guard.** Before re-rendering, previously sealed blob hashes are
  compared to the freshly downloaded blobs; a mismatch aborts with a 409
  instead of baking a swapped image into a new, validly sealed PDF.
- **Authenticated verify folds it in.** `verify-seal` (sub and GC) also checks
  the `pdf_seal` HMAC and re-downloads each sealed blob. Any mismatch makes
  `valid: false` and adds `imageMismatches` (`crewPhoto` or a named
  signature). A download failure propagates as a 502, never as "tampered".
- **A visible mark on the report.** A sealed meeting's PDF carries a navy
  shield-with-check icon: small beside the title ("TAMPER-EVIDENT RECORD") and
  as a labelled block in the footer above the `Content seal:` fragment
  (`drawSealIcon` in `pdfGeneration.js`, vector, no image asset). It is a
  presentation cue only: anyone could copy it onto an edited file, so it proves
  nothing by itself. The QR code / `/verify/:id` page is the actual check.
  Unsealed meetings get neither mark.

### Public verification (QR code)

Every PDF now prints a QR code and URL, `${CLIENT_URL}/verify/:meetingId`,
beside the content-seal line. That page needs no account (a GC who never
signed up, an insurer, an inspector):

| Endpoint | Body | Success |
| --- | --- | --- |
| `GET /api/public/meetings/:id/verify` | none | `{ sealed, valid, sealedAt, fileFingerprint, imageMismatchCount }` |
| `POST /api/public/meetings/:id/verify-file` | `{ sha256 }` (64 hex) | `{ matches, status }`, `status` one of `current`, `superseded`, `no-match`, `record-altered` |

The browser hashes the dropped PDF with SubtleCrypto; the file is never
uploaded. Responses are pass/fail only: no company, project or worker names,
and the image check returns a count, not names. Both record a `seal_verified`
audit event with `via: "public"`. Meetings sealed before this shipped have no
fingerprint: the page checks records only (`fileFingerprint: false`) and
`verify-file` 404s.

### Backfilling earlier meetings (optional)

`node scripts/backfill-pdf-seals.js [--apply] [--id|--company|--since|--limit]`
(dry run by default) gives sealed meetings that predate the PDF seal a file
fingerprint. It hashes the PDF and embedded images **currently in Storage** and
seals those hashes (`server/services/pdfSealBackfill.js`), so it vouches for what
is stored today, not for what existed at completion. It never re-renders, so the
file (and any copy already emailed) keeps its bytes, and these PDFs have no QR
code; the "Check a PDF file" link on the badge is how they get checked. Meetings
whose content seal already fails are skipped, a Storage read failure aborts that
meeting so a re-run can retry it, and each run records a `pdf_generated` audit
event with `backfilled: true` so a later regenerate leaves the old file
"superseded". Idempotent: a meeting with a PDF seal is never selected.

## Known v1 limitations

- **No backfill.** A meeting completed before this shipped has no seal — its
  row shows no badge at all, never a false claim either way.
- **Image blobs are only covered after the first render.** Signature and
  crew-photo bytes are hashed when the PDF is rendered (see "PDF seal" below),
  not when the meeting is completed, so a blob swapped in the few seconds
  between `complete()` and the render is sealed as if genuine. The original
  `content_seal` itself still pins only storage paths/ids.
- **The printed PDF fragment isn't self-verifying.** `shortSeal`'s 12
  characters on the footer are a human receipt, not a checksum. Real
  verification goes through the endpoints, or the QR code beside it.
- **Superseded history is unsealed.** "Superseded" file matches are read from
  `pdf_generated` audit events, which aren't individually HMAC'd, so they are
  a weaker answer than "current".
- **Public endpoints are throttled per IP only.** `/api/public/*` allows 30
  requests/minute per IP (`publicRateLimit`); the image re-check still
  downloads blobs on every allowed request, and the limit relies on
  `trust proxy` matching the real deployment.
- **The audit log has no viewer UI yet.** `meeting_log_audit_events` is
  write-only in v1 — no admin/GC page reads it.
- **No GPS capture**, by decision (see "Scope").
