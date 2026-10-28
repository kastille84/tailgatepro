// Shared tamper-evidence checks (docs/tamper-evidence-design.md): the content
// seal over DB fields, the PDF seal over the rendered file's digest, and the
// embedded-image re-check. Reused by the public verify endpoints
// (publicVerify.js) and the authenticated sub/GC verify-seal endpoints, so the
// three can't drift. No Express types; Supabase + Storage reads only.
const { supabase } = require("../utility/supabaseClient");
const { AppError } = require("../utility/AppError");
const contentSeal = require("../utility/contentSeal");
const storageService = require("./storage");

const CREW_PHOTO_BUCKET = "crew-photos";
const SIGNATURE_BUCKET = "signatures";

// Columns every caller must select from meeting_logs to use this module.
const SEAL_ROW_COLUMNS =
  "id, project_id, talk_id, foreman_id, company_id, crew_photo_url, held_at, completed_at, content_seal, sealed_at, pdf_sha256, pdf_seal, blob_hashes";

const loadSignatures = async (meetingId) => {
  const { data, error } = await supabase
    .from("signatures")
    .select("id, worker_name, quiz_score, quiz_passed, signature_path")
    .eq("meeting_id", meetingId);

  if (error) {
    throw new AppError("Could not verify the meeting's signatures", 502, {
      cause: error,
    });
  }
  return data;
};

// Recomputes the content seal from current DB state. `row` is a meeting_logs
// row (SEAL_ROW_COLUMNS); `signatures` is loadSignatures()'s result.
const isContentSealValid = (row, signatures) => {
  const expectedSeal = contentSeal.computeSeal(
    contentSeal.buildCanonicalPayload({
      meetingLog: {
        id: row.id,
        projectId: row.project_id,
        talkId: row.talk_id,
        companyId: row.company_id,
        foremanId: row.foreman_id,
        crewPhotoUrl: row.crew_photo_url,
        heldAt: row.held_at,
        completedAt: row.completed_at,
      },
      signatures: signatures.map((s) => ({
        id: s.id,
        workerName: s.worker_name,
        quizScore: s.quiz_score,
        quizPassed: s.quiz_passed,
      })),
    }),
  );
  return contentSeal.sealsMatch(expectedSeal, row.content_seal);
};

// Whether the stored pdf_sha256 + blob_hashes still match their HMAC, i.e.
// nobody with only DB write access edited the recorded hashes. `null` = this
// meeting has no PDF seal (never rendered, or completed before it shipped).
const isPdfSealIntact = (row) => {
  if (!row.pdf_seal || !row.pdf_sha256) return null;
  const expected = contentSeal.computePdfSeal(
    contentSeal.buildPdfPayload({
      id: row.id,
      pdfSha256: row.pdf_sha256,
      blobHashes: row.blob_hashes,
    }),
  );
  return contentSeal.sealsMatch(expected, row.pdf_seal);
};

// Re-downloads every blob that was embedded in the PDF and compares it to the
// hash sealed at render time. Returns the mismatches as
// `{ kind: "crewPhoto" } | { kind: "signature", id, workerName }`. A blob whose
// sealed hash is null (it couldn't be downloaded at render time) is skipped. A
// download failure propagates (502) rather than being reported as tampering:
// "couldn't check" must not read as "was altered". An empty list is returned
// when there is no PDF seal to compare against.
const findImageMismatches = async (row, signatures) => {
  const sealed = row.blob_hashes;
  if (!sealed || !row.pdf_seal) return [];

  const matchesSealed = async (bucket, path, sealedHash) => {
    const bytes = await storageService.downloadBlob(bucket, path);
    return contentSeal.sha256Hex(bytes) === sealedHash;
  };

  const mismatches = [];

  if (sealed.crewPhoto && row.crew_photo_url) {
    const ok = await matchesSealed(
      CREW_PHOTO_BUCKET,
      row.crew_photo_url,
      sealed.crewPhoto,
    );
    if (!ok) mismatches.push({ kind: "crewPhoto" });
  }

  const checks = signatures
    .filter((s) => sealed.signatures?.[s.id] && s.signature_path)
    .map(async (s) => {
      const ok = await matchesSealed(
        SIGNATURE_BUCKET,
        s.signature_path,
        sealed.signatures[s.id],
      );
      if (!ok) {
        mismatches.push({ kind: "signature", id: s.id, workerName: s.worker_name });
      }
    });
  await Promise.all(checks);

  return mismatches;
};

// Every sha256 a past render of this meeting recorded in its pdf_generated
// audit events (the current one included). Used to tell an older but genuine
// copy ("superseded") apart from a file TailgatePro never produced.
const listRenderedHashes = async (meetingId) => {
  const { data, error } = await supabase
    .from("meeting_log_audit_events")
    .select("metadata")
    .eq("meeting_log_id", meetingId)
    .eq("event_type", "pdf_generated");

  if (error) {
    throw new AppError("Could not load the report history", 502, { cause: error });
  }
  return data.map((event) => event.metadata?.sha256).filter(Boolean);
};

module.exports = {
  SEAL_ROW_COLUMNS,
  loadSignatures,
  isContentSealValid,
  isPdfSealIntact,
  findImageMismatches,
  listRenderedHashes,
};
