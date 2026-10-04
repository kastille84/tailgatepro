// Streams a Defense Bundle ZIP — the GC's per-jobsite one (Phase 9e,
// docs/osha-defense-bundle-design.md) and the sub's own all-my-logs one
// (docs/sub-defense-bundle-design.md) both use this; it never actually
// depended on "jobsite", just a list of entries and an output stream.
// `outputStream` is only ever touched as a generic writable (`.pipe`, an
// `"error"` listener) — no Express types, no header/status-code access — so
// this still respects "services never touch req/res" even though the
// controller passes `res` in; setting headers stays the controller's job.
const archiver = require("archiver");
const storageService = require("./storage");
const { PDF_BUCKET } = require("./meetingLogs");
const { buildBundleIndexCsv } = require("../utility/buildBundleIndex");

// `entries` is a getDefenseBundleEntries output:
// { path, filename, companyName, projectName, talkTitle, heldAt }[]. PDFs are
// downloaded one at a time via the existing storageService.downloadBlob, so
// peak memory is one PDF's buffer plus archiver's own compression buffering,
// not the whole archive (docs/osha-defense-bundle-design.md's known
// limitations note the sequential-download trade-off). `header` is forwarded
// to buildBundleIndexCsv unchanged — see its own comment for why the sub-side
// caller overrides it.
const streamBundle = (entries, outputStream, { skippedCount = 0, header } = {}) =>
  new Promise((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });

    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const succeed = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    archive.on("error", fail);
    outputStream.on("error", fail);
    outputStream.on("finish", succeed);

    archive.pipe(outputStream);
    // `header` may be undefined here — buildBundleIndexCsv's own default
    // parameter (`header = HEADER`) applies to an explicit undefined just as
    // it would to an omitted key, so no conditional is needed.
    archive.append(buildBundleIndexCsv(entries, { skippedCount, header }), {
      name: "index.csv",
    });

    (async () => {
      for (const entry of entries) {
        const buffer = await storageService.downloadBlob(PDF_BUCKET, entry.path);
        archive.append(buffer, { name: entry.filename });
      }
      await archive.finalize();
    })().catch(fail);
  });

module.exports = { streamBundle };
