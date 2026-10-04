// Pure HMAC-SHA256 content seal for a completed meeting log (Phase 9e,
// docs/tamper-evidence-design.md). No Supabase, no Express — reused
// identically by the seal-writing step (meetingLogs.js's complete()) and
// every later verification (meetingLogs.js's verifySeal, gcDashboard.js's
// verifySeal), so a byte-for-byte reproducible payload is the whole point:
// change the key order or serialization here and every previously-sealed
// meeting log stops verifying.
const crypto = require("crypto");
const envUtils = require("./envUtils");

// Per-signature fields covered by the seal. Not `signaturePath`/image bytes —
// a storage-blob swap at the same path isn't detected by this v1 (see the
// design doc's "Known v1 limitations").
const toSealSignature = (signature) => ({
  id: signature.id,
  workerName: signature.workerName,
  quizScore: signature.quizScore,
  quizPassed: signature.quizPassed,
});

// `heldAt`/`completedAt` reach this function in two different lexical forms
// depending on the caller: complete() passes a JS `Date#toISOString()`
// string (e.g. "2026-09-29T13:46:27.358Z"), while every verify path passes a
// TIMESTAMPTZ column value round-tripped through Postgres/PostgREST, which
// serializes the same instant differently (e.g. a "+00:00" offset instead of
// "Z", or no fractional digits at all when they're exactly zero). Both name
// the same instant, but the HMAC is computed over the literal JSON string, so
// without normalizing here every verification of a real, untampered row would
// fail. `new Date(value).toISOString()` is a pure function of the instant, so
// both forms collapse to the same canonical string.
const toCanonicalTimestamp = (value) =>
  value == null ? value : new Date(value).toISOString();

/**
 * Builds the canonical, deterministic JSON string the HMAC is computed over.
 * Signatures are sorted by `id` ascending so DB row order never changes the
 * payload. Excludes `finalPdfUrl` (doesn't exist yet when complete() seals
 * the record) and the talk's own content (only `talkId` is pinned — the
 * shared library talk's content itself isn't meeting-specific evidence).
 * @param {object} params
 * @param {object} params.meetingLog - camelCase: id, projectId, talkId, companyId,
 *   foremanId, crewPhotoUrl, heldAt, completedAt.
 * @param {object[]} params.signatures - camelCase: id, workerName, quizScore, quizPassed.
 * @returns {string}
 */
const buildCanonicalPayload = ({ meetingLog, signatures }) => {
  const sortedSignatures = [...signatures]
    .map(toSealSignature)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  return JSON.stringify({
    id: meetingLog.id,
    projectId: meetingLog.projectId,
    talkId: meetingLog.talkId,
    companyId: meetingLog.companyId,
    foremanId: meetingLog.foremanId,
    crewPhotoUrl: meetingLog.crewPhotoUrl,
    heldAt: toCanonicalTimestamp(meetingLog.heldAt),
    completedAt: toCanonicalTimestamp(meetingLog.completedAt),
    signatures: sortedSignatures,
  });
};

const getSecret = () => {
  const secret = envUtils.keysBasedOnEnv().meetingLogSeal.secret;
  if (!secret) {
    throw new Error("MEETING_LOG_SEAL_SECRET is not configured");
  }
  return secret;
};

// HMAC-SHA256 hex digest of `payload` (from buildCanonicalPayload), keyed by
// the server-only MEETING_LOG_SEAL_SECRET. Never sent to the client.
const computeSeal = (payload) =>
  crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");

// A short, human-eyeballable fragment printed on the PDF footer
// (pdfGeneration.js) — not itself validated against anything; real
// verification always recomputes the full HMAC server-side via the verify
// endpoints.
const shortSeal = (seal) => seal.slice(0, 12).toUpperCase();

// Timing-safe comparison between a freshly-recomputed seal and the one stored
// on the row, so verification doesn't leak timing information about how much
// of the secret-derived digest matched.
const sealsMatch = (a, b) => {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
};

module.exports = { buildCanonicalPayload, computeSeal, shortSeal, sealsMatch };
