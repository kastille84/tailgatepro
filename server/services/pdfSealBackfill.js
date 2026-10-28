// One meeting's retroactive PDF seal (docs/tasks.md 16k), for
// scripts/backfill-pdf-seals.js. Meetings completed before the PDF seal shipped
// have no pdf_sha256 / blob_hashes, so the public verify page can only vouch for
// their records. This hashes the PDF and embedded images *currently in Storage*
// and seals those hashes -- it vouches for whatever is stored today, not for what
// was stored at completion. It therefore refuses a meeting whose content seal
// already fails, rather than blessing a record known to be altered.
//
// Never re-renders (the existing file keeps its bytes, so already-emailed copies
// still match) and never touches content_seal. No Express types.
const { supabase } = require("../utility/supabaseClient");
const { AppError } = require("../utility/AppError");
const contentSeal = require("../utility/contentSeal");
const storageService = require("./storage");
const auditLogService = require("./auditLog");
const sealVerification = require("./sealVerification");
const meetingLogsService = require("./meetingLogs");

const hashBlob = async (bucket, path) =>
  contentSeal.sha256Hex(await storageService.downloadBlob(bucket, path));

/**
 * @returns {Promise<{status: "backfilled", pdfSha256: string} |
 *   {status: "skipped", reason: string}>}
 * @throws {AppError} when the meeting is missing or a Storage read fails, so the
 *   caller can report it and a re-run can retry (a transient download failure
 *   must not be sealed in as "no image").
 */
const backfillPdfSeal = async (meetingLogId) => {
  const { data: row, error } = await supabase
    .from("meeting_logs")
    .select(`${sealVerification.SEAL_ROW_COLUMNS}, final_pdf_url`)
    .eq("id", meetingLogId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new AppError("Meeting not found", 404, { cause: error });
    }
    throw new AppError("Could not load the meeting", 502, { cause: error });
  }

  if (!row.completed_at || !row.content_seal) {
    return { status: "skipped", reason: "not sealed" };
  }
  if (!row.final_pdf_url) {
    return { status: "skipped", reason: "no PDF in Storage" };
  }
  if (row.pdf_seal) {
    return { status: "skipped", reason: "already has a PDF seal" };
  }

  const signatures = await sealVerification.loadSignatures(meetingLogId);
  if (!sealVerification.isContentSealValid(row, signatures)) {
    return { status: "skipped", reason: "content seal does not verify" };
  }

  const pdfSha256 = await hashBlob(meetingLogsService.PDF_BUCKET, row.final_pdf_url);
  const signatureEntries = await Promise.all(
    signatures.map(async (signature) => [
      signature.id,
      signature.signature_path
        ? await hashBlob("signatures", signature.signature_path)
        : null,
    ]),
  );
  const blobHashes = {
    crewPhoto: row.crew_photo_url
      ? await hashBlob("crew-photos", row.crew_photo_url)
      : null,
    signatures: Object.fromEntries(signatureEntries),
  };

  await meetingLogsService.setPdfSeal(meetingLogId, row.company_id, {
    pdfSha256,
    pdfSeal: contentSeal.computePdfSeal(
      contentSeal.buildPdfPayload({ id: meetingLogId, pdfSha256, blobHashes }),
    ),
    blobHashes,
  });
  // Same event type the renderer records, so a later regenerate leaves this
  // file's digest in the history and an emailed copy reads "superseded".
  await auditLogService.record({
    meetingLogId,
    eventType: "pdf_generated",
    metadata: { path: row.final_pdf_url, sha256: pdfSha256, backfilled: true },
  });

  return { status: "backfilled", pdfSha256 };
};

module.exports = { backfillPdfSeal };
