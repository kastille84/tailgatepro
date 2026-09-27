// Streams a jobsite's Defense Bundle ZIP (Phase 9e, docs/osha-defense-bundle-design.md).
// `outputStream` is only ever touched as a generic writable (`.pipe`, an
// `"error"` listener) — no Express types, no header/status-code access — so
// this still respects "services never touch req/res" even though the
// controller passes `res` in; setting headers stays the controller's job.
const archiver = require("archiver");
const storageService = require("./storage");
const { PDF_BUCKET } = require("./meetingLogs");
const { buildBundleIndexCsv } = require("../utility/buildBundleIndex");

// `entries` is `gcDashboard.js`'s getDefenseBundleEntries output:
// { path, filename, companyName, projectName, talkTitle, heldAt }[]. PDFs are
// downloaded one at a time via the existing storageService.downloadBlob, so
// peak memory is one PDF's buffer plus archiver's own compression buffering,
// not the whole archive (docs/osha-defense-bundle-design.md's known
// limitations note the sequential-download trade-off).
const streamJobsiteBundle = (entries, outputStream, { skippedCount = 0 } = {}) =>
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
    archive.append(buildBundleIndexCsv(entries, { skippedCount }), { name: "index.csv" });

    (async () => {
      for (const entry of entries) {
        const buffer = await storageService.downloadBlob(PDF_BUCKET, entry.path);
        archive.append(buffer, { name: entry.filename });
      }
      await archive.finalize();
    })().catch(fail);
  });

module.exports = { streamJobsiteBundle };
