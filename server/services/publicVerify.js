// Unauthenticated verification behind the QR code printed on every report
// (docs/tamper-evidence-design.md "PDF seal"). Anyone holding a meeting's
// UUID -- a GC without an account, an insurer, an inspector -- can ask
// whether its records and a given PDF file are still what TailgatePro sealed.
//
// Deliberately leaks nothing but pass/fail: no company, project or worker
// names. Every call is recorded as a seal_verified audit event
// (via: "public"), the same as the authenticated verify-seal endpoints.
const { supabase } = require("../utility/supabaseClient");
const { AppError } = require("../utility/AppError");
const contentSeal = require("../utility/contentSeal");
const auditLogService = require("./auditLog");
const sealVerification = require("./sealVerification");

const loadSealedMeeting = async (id) => {
  const { data, error } = await supabase
    .from("meeting_logs")
    .select(sealVerification.SEAL_ROW_COLUMNS)
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new AppError("Meeting not found", 404, { cause: error });
    }
    throw new AppError("Could not load the meeting", 502, { cause: error });
  }
  if (!data.completed_at) {
    throw new AppError("Meeting not found", 404);
  }
  if (!data.content_seal) {
    throw new AppError("This meeting hasn't been sealed yet", 404);
  }
  return data;
};

/**
 * GET /api/public/meetings/:id/verify -- are this meeting's records (and the
 * images embedded in its PDF) still what was sealed?
 * @returns {Promise<{sealed: true, valid: boolean, sealedAt: string,
 *   fileFingerprint: boolean, imageMismatchCount: number}>}
 */
const verifyRecord = async (id) => {
  const row = await loadSealedMeeting(id);
  const signatures = await sealVerification.loadSignatures(id);

  const contentValid = sealVerification.isContentSealValid(row, signatures);
  const pdfSealIntact = sealVerification.isPdfSealIntact(row);
  const mismatches = await sealVerification.findImageMismatches(row, signatures);

  const valid = contentValid && pdfSealIntact !== false && mismatches.length === 0;

  await auditLogService.record({
    meetingLogId: id,
    eventType: "seal_verified",
    actorId: null,
    metadata: { valid, via: "public", imageMismatchCount: mismatches.length },
  });

  return {
    sealed: true,
    valid,
    sealedAt: row.sealed_at,
    // Whether a file fingerprint exists to check a dropped PDF against; false
    // for meetings completed before the PDF seal shipped.
    fileFingerprint: pdfSealIntact !== null,
    imageMismatchCount: mismatches.length,
  };
};

/**
 * POST /api/public/meetings/:id/verify-file -- does a PDF with this SHA-256
 * match the one TailgatePro generated? The browser hashes the file; it is
 * never uploaded.
 *  - "current":    byte-identical to the latest generated report.
 *  - "superseded": byte-identical to an earlier genuine render (the report was
 *                  regenerated since). Weaker than "current": the history comes
 *                  from audit events, which aren't individually sealed.
 *  - "no-match":   not a file TailgatePro produced, or it was edited.
 *  - "record-altered": the stored fingerprint itself fails its HMAC.
 * @returns {Promise<{matches: boolean, status: string}>}
 */
const verifyFile = async (id, sha256) => {
  const row = await loadSealedMeeting(id);

  const pdfSealIntact = sealVerification.isPdfSealIntact(row);
  if (pdfSealIntact === null) {
    throw new AppError("No file fingerprint is on record for this report", 404);
  }

  let status;
  if (!pdfSealIntact) {
    status = "record-altered";
  } else if (contentSeal.sealsMatch(row.pdf_sha256, sha256)) {
    status = "current";
  } else if ((await sealVerification.listRenderedHashes(id)).includes(sha256)) {
    status = "superseded";
  } else {
    status = "no-match";
  }

  await auditLogService.record({
    meetingLogId: id,
    eventType: "seal_verified",
    actorId: null,
    metadata: { valid: status === "current", via: "public", file: true, status },
  });

  return { matches: status === "current" || status === "superseded", status };
};

module.exports = { verifyRecord, verifyFile };
