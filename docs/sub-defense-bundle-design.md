# Subcontractor OSHA Defense Bundle (ZIP export) Design

Status: **decided**. The GC-facing "1-Click OSHA Defense Bundle" (`docs/osha-defense-bundle-design.md`)
is per-jobsite and Site Pro only. This is the same idea for the other audience: an independent
subcontractor — including one whose GC doesn't use TailgatePro at all — downloading every one of
their own completed meeting logs as one ZIP, for their own OSHA protection. Full plan:
`~/.claude/plans/let-s-work-on-the-tingly-feigenbaum.md`.

## Scope

Every completed meeting log the caller's company has ever logged, across every project and every
GC/client, no date filter, no per-project split. Unlike the GC side, a sub isn't organized by
jobsite — the Meeting History page (`/meetings`) is already one flat list — so there's no natural
narrower scope to offer, and an independent sub protecting themselves wants "all my records" in one
shot, not one export per client.

## Gating: `archiveYears > 0` (Trade Pro / Trade Enterprise)

`entitlements.getLimits(companyType, tier).archiveYears` is `0` for Trade Free and `5` for Trade
Pro/Enterprise (`server/utility/entitlements.js`) — reused as-is rather than adding a new limit,
since it's already the exact line Trade Pro's marketing pitch draws ("5-year legal archive for OSHA
audits"). Trade Free gets a 403 `PLAN_LIMIT` and keeps today's one-at-a-time "Open PDF" flow
(`GET /api/meetings/:id/pdf-url`). `companyType`/`tier` come straight from `req.user` (already
resolved by `loadUserContext`) rather than a second `companiesService.getById` lookup — unlike this
controller's older `getHistoryDays` helper, this gate needs no extra DB round trip.

## Delivery: same streaming approach as the GC bundle

Reuses `server/services/zipBundle.js`'s `streamBundle` (renamed from `streamJobsiteBundle` — it
never actually depended on "jobsite", just a list of entries and an output stream) unchanged: an
`archiver` zip piped straight to the response as each PDF is downloaded from Storage one at a time.
No new Storage bucket, no caching — same trade-offs and the same rejected "upload to Storage, return
a signed URL" alternative already documented in the GC design doc.

## Contents

- Every completed log's PDF, named via the existing `buildPdfFilename` (company + project + date +
  short id) — identical convention to every other PDF download in the app.
- `index.csv` — same shape as the GC bundle's, but the **"Company" column is repurposed**. In the GC
  bundle every row is a different subcontractor, so "Company" names who ran the talk; in a sub's own
  bundle every row is the *same* company (repeating it would be dead weight), while the sub may work
  under several different GCs — so this column instead holds the project's GC/client name
  (`projects.gc_name_custom`, the header relabeled "GC / Client" via `buildBundleIndexCsv`'s new
  optional `header` param). `gc_name_custom` is populated whether the project is linked to a GC
  that's actually on TailgatePro or the sub just typed the GC's name in by hand — so this still works
  for the exact case motivating this feature, an independent sub whose GC never touches the app.
- A completed log with no `final_pdf_url` yet is skipped, not fatal; `index.csv` notes the skipped
  count. If **no** completed log has a PDF yet, the endpoint 404s.

## Endpoint contract

Same conventions as `docs/osha-defense-bundle-design.md`'s table: `requireAuth → loadUserContext`
(no `requireSubcontractorCompany` gate needed — the query is scoped to the caller's own
`companyId` regardless of company type, and a GC calling it simply gets an empty/404 result since GCs
don't own `meeting_logs` rows).

| Endpoint | Returns |
| --- | --- |
| `GET /api/meetings/defense-bundle` | A streamed `application/zip` body, `Content-Disposition: attachment; filename="<company-slug>-defense-bundle.zip"`. 404 if nothing has a PDF yet. 403 `PLAN_LIMIT` if the caller's plan has no legal archive (Trade Free). |

## Client UX while assembling

Reuses the generalized `ProgressModal` (`client/src/ui_comps/progress-modal/ProgressModal.tsx`) —
the same non-dismissable, indeterminate "this can take a minute" modal built for the GC bundle,
promoted out of the jobsites feature into a shared primitive rather than duplicated. Same reasoning
applies for why it isn't a percentage bar: no `Content-Length`, no cheap size-estimate call.

## Known v1 limitations

- **Sequential per-PDF downloads** and **no PostgREST 1,000-row chunking** — same trade-offs as the
  GC bundle, for the same reasons (`docs/osha-defense-bundle-design.md`), likely to matter even less
  here since a single company's own history is smaller than a whole jobsite's.
- **A mid-stream failure can't produce a normal JSON error** — identical to the GC bundle's own
  limitation, same `res.destroy(error)` fallback.
- **No jobsite-equivalent narrowing.** A sub with a very long history can't download "just this
  client" or "just this year" — only everything at once. Revisit if that turns out to matter in
  practice.
