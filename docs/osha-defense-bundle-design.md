# OSHA Defense Bundle (ZIP export) Design (Phase 9e)

Status: **decided**. Covers the "1-Click OSHA Defense Bundle" promised to GC Site Pro
(`docs/pricing-and-positioning-strategy_V2.md`: "Download indexed ZIP of all site logs instantly").
Full plan: `~/.claude/plans/let-s-work-on-the-tingly-feigenbaum.md`. See `docs/tasks.md` 9e and
`docs/pricing-promise-gaps.md` for how this was tracked before it was built.

## Scope

One jobsite, every completed meeting log on it, no date filter — matches the Site Pro promise
literally. GC Portfolio's promised version ("Portfolio-Wide Search" — a multi-site export,
`docs/pricing-and-positioning-strategy_V2.md`'s comparison table) is a separate, bigger, not-yet-scoped
feature and is untouched here.

## Gating: per-jobsite only

`jobsites.plan === "site_pro"` gates the whole endpoint — no blending with the GC company's own
tier/`gc-portfolio` plan id, since `client/src/data/plans.ts` doesn't promise this to Portfolio yet.
This is a direct field check, the same style as the existing inline `plan === "site_pro"` checks in
`server/services/jobsites.js`, `subAccess.js` and `sponsorship.js` — no new entitlements.js helper.
A non-`site_pro` jobsite gets a 403 `PLAN_LIMIT`, same shape every other plan-gated endpoint in this
codebase already returns.

## Delivery: streamed, not cached

The route streams the ZIP straight to the HTTP response via `archiver` as each PDF is downloaded from
Storage (one at a time, via the existing `storageService.downloadBlob`). No new Storage bucket, no
pre-building/caching — always current, and consistent with this codebase's "never cache a derived
artifact, always mint it fresh" convention (signed URLs, PDF regeneration). The trade-off: this is a
genuinely new client download shape — a real binary stream, not a signed URL — so the client can't
reuse `window.open(url)` the way every other PDF download does; it needs a small fetch→blob→synthetic-
`<a>`-download utility instead (`client/src/utils/triggerBrowserDownload.ts`).

An alternative considered and rejected: build the zip in memory, upload it to Storage, and return a
signed URL like every other PDF endpoint. That would let the client reuse the existing pattern exactly,
but costs an extra Storage round-trip, a temporary object with no obvious cleanup story, and a bucket
that would need its own retention decision — not worth it for a feature this reuses so much of.

## Contents

- Every completed meeting log's PDF, named via the existing `buildPdfFilename`
  (`server/utility/pdfFilename.js`) — the same convention already used for every other PDF download in
  the app, so a bundle sorts identically to the single-file downloads a GC already knows.
- `index.csv` — Company, Project, Talk, Held At, Filename — satisfies "**indexed** ZIP", not just a pile
  of files sorted by name.
- A completed log whose `final_pdf_url` is still null (generation failed or hasn't run yet) is skipped,
  not fatal; `index.csv` notes the skipped count in a trailing line. If **no** completed log has a PDF
  yet, the whole endpoint 404s instead of returning an index-only ZIP.

## Endpoint contract

Same conventions as `docs/gc-dashboard-design.md`'s table: `requireAuth → loadUserContext →
requireGcCompany`, camelCase, a jobsite outside the caller's authorization (wrong GC, or outside a
site-scoped superintendent's assigned sites, Phase 9d-2) is a 404, never a 403.

| Endpoint | Returns |
| --- | --- |
| `GET /api/gc/jobsites/:id/defense-bundle` | A streamed `application/zip` body (not the usual `{ success, data }` envelope — there's no JSON to wrap), `Content-Disposition: attachment; filename="<jobsite-slug>-defense-bundle.zip"`. 404 if the jobsite isn't owned/allowed, or if no completed log has a PDF yet. 403 `PLAN_LIMIT` if the jobsite isn't on Site Pro. |

## Client UX while assembling

`useDownloadDefenseBundle` fires a single `fetch` and doesn't resolve until the whole ZIP has
downloaded, which can take a while on a site with a lot of completed logs (sequential per-PDF Storage
downloads, see below). While that mutation is pending, `JobsiteManager` shows a non-dismissable
`DefenseBundleProgressModal` (`client/src/features/jobsites/DefenseBundleProgressModal.tsx`) — a
spinner plus copy explaining the wait — so the GC doesn't mistake the delay for the click doing
nothing. It's deliberately **indeterminate**, not a percentage bar: the response never sets
`Content-Length` (the compressed size isn't known until `archive.finalize()` completes in
`zipBundle.js`), and `storageService` has no cheap "size without downloading" call to estimate one
from up front. A real determinate bar would need either pre-summing entry sizes via a new Storage
`list()` call (an estimate only, since it wouldn't account for compression) or a different transport
altogether (e.g. Server-Sent Events reporting per-entry progress) — out of scope for v1.

## Known v1 limitations

- **Sequential per-PDF downloads.** Each PDF is fetched from Storage one at a time before being
  appended to the archive, so total time scales with log count. Fine at expected site sizes (a single
  jobsite's meeting count); revisit with bounded concurrency if a real site turns out to have hundreds
  of completed logs.
- **No PostgREST 1000-row chunking.** Unlike `meetingLogs.listMonthSummaries`, the meeting-log query
  behind this endpoint doesn't page through results in 1,000-row chunks. Not built, since a single
  jobsite is very unlikely to exceed that in v1 — flagged here so it isn't forgotten if that assumption
  ever breaks.
- **A mid-stream failure can't produce a normal JSON error.** Once `res` has flushed headers (and
  possibly some zip bytes), a failed `storageService.downloadBlob` call can only destroy the connection
  (`res.destroy(error)`), not call `next(error)` — the client sees a truncated/failed download, not a
  parseable error body. Acceptable for v1; there's no existing precedent in this codebase for a
  mid-stream error surfaced more gracefully than that.
