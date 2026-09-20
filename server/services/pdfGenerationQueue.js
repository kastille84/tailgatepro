// Phase 5 hook point (see docs/tasks.md Phase 5, docs/meeting-flow-design.md).
// meetingLogs.js's complete() calls this the instant a meeting is finalized:
// fetches the meeting's project/talk/signatures (and, if present, its crew
// photo bytes), renders a PDF via pdfGeneration.js, uploads it to the
// `meeting-pdfs` bucket, and records its path on meeting_logs.final_pdf_url.
//
// Soft-fail, per the design doc: every failure is caught and logged here,
// never thrown, so a render/upload/email problem can't unwind complete()'s
// completed_at stamp or fail that request.
const projectsService = require("./projects");
const talksService = require("./talks");
const storageService = require("./storage");
// companies.js has no reverse dependency anywhere in this file's require
// chain (only needs supabase/AppError), so it's safe to require at the top
// level — unlike meetingLogs.js/signatures.js below, which are required
// lazily inside enqueue() to avoid a circular require (see the comment
// there).
const companiesService = require("./companies");
// Required as the module object, not destructured: a destructured binding
// would capture the function reference at require-time, which vi.spyOn's
// property-replacement on the module object (used in
// pdfGenerationQueue.test.js) wouldn't reach.
const pdfGeneration = require("./pdfGeneration");
const { buildPdfFilename } = require("../utility/pdfFilename");
// email.js's own require chain (mailgun.js, form-data, envUtils,
// formatDate) has no service-layer requires and nothing in it requires this
// file back, so — like pdfGeneration/companiesService above — it's safe at
// the top level, unlike meetingLogsService/signaturesService below.
const emailService = require("./email");

const PDF_BUCKET = "meeting-pdfs";
const CREW_PHOTO_BUCKET = "crew-photos";
const SIGNATURE_BUCKET = "signatures";
const LOGO_BUCKET = "company-logos";
// A GC may not open this email for days — much longer-lived than
// meetingLogs.js's PDF_URL_TTL_SECONDS (300s), which is only used for the
// on-demand signed-URL endpoint consumed immediately by a logged-in user.
const EMAIL_PDF_URL_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

const enqueue = async (meetingLogId, companyId) => {
  try {
    // meetingLogs.js and signatures.js are required lazily, not at module
    // top-level: meetingLogs.js requires this file too (to call enqueue from
    // complete()), and signatures.js requires meetingLogs.js — so a
    // top-level require of either here closes a circular-require loop. This
    // codebase's `module.exports = {...}` style (reassignment, not
    // incremental `exports.x =`) means whichever module in a cycle finishes
    // loading second hands the other a stale, empty exports object.
    // Requiring inside the function runs after every module has finished
    // loading, so the cache always returns the real, fully-populated module.
    const meetingLogsService = require("./meetingLogs");
    const signaturesService = require("./signatures");

    const meetingLog = await meetingLogsService.getById(meetingLogId, companyId);

    const [project, talk, signatures, company] = await Promise.all([
      projectsService.getById(meetingLog.projectId, companyId),
      meetingLog.talkId
        ? talksService.getById(meetingLog.talkId, companyId)
        : null,
      signaturesService.listForMeeting(meetingLogId, companyId),
      companiesService.getById(companyId),
    ]);

    let crewPhotoBuffer = null;
    if (meetingLog.crewPhotoUrl) {
      try {
        crewPhotoBuffer = await storageService.downloadBlob(
          CREW_PHOTO_BUCKET,
          meetingLog.crewPhotoUrl,
        );
      } catch (photoError) {
        // A photo we can't download degrades to "no crew photo on file" in
        // the rendered PDF (see pdfGeneration.js) rather than aborting the
        // whole report.
        console.error(
          `pdfGenerationQueue: could not download crew photo for meeting ${meetingLogId}`,
          photoError,
        );
      }
    }

    // The company's uploaded logo, downloaded the same best-effort way as
    // the crew photo: a failed/missing logo degrades to no logo (and the
    // watermark is gated on tier alone, not logo presence — see
    // pdfGeneration.js), it never aborts the whole PDF.
    let logoBuffer = null;
    if (company?.logoPath) {
      try {
        logoBuffer = await storageService.downloadBlob(
          LOGO_BUCKET,
          company.logoPath,
        );
      } catch (logoError) {
        console.error(
          `pdfGenerationQueue: could not download company logo for meeting ${meetingLogId}`,
          logoError,
        );
      }
    }

    // Each signature's own drawn-image blob, downloaded the same
    // best-effort way as the crew photo: one signature's image failing to
    // download doesn't abort the whole PDF, it just prints without that
    // signer's image (see pdfGeneration.js's "(signature image
    // unavailable)" fallback).
    const signaturesWithImages = await Promise.all(
      signatures.map(async (signature) => {
        try {
          const imageBuffer = await storageService.downloadBlob(
            SIGNATURE_BUCKET,
            signature.signaturePath,
          );
          return { ...signature, imageBuffer };
        } catch (signatureError) {
          console.error(
            `pdfGenerationQueue: could not download a signature image for meeting ${meetingLogId}`,
            signatureError,
          );
          return { ...signature, imageBuffer: null };
        }
      }),
    );

    const pdfBuffer = await pdfGeneration.renderMeetingLogPdf({
      meetingLog,
      project,
      talk,
      signatures: signaturesWithImages,
      crewPhotoBuffer,
      company,
      logoBuffer,
    });

    const path = meetingLogsService.pdfPath(meetingLogId);
    await storageService.uploadBlob(PDF_BUCKET, path, pdfBuffer, "application/pdf");
    await meetingLogsService.setFinalPdfUrl(meetingLogId, companyId, path);

    // gc_contact_email is an optional, manually-entered field (Phase 5c) --
    // silently skip when unset, per docs/tasks.md 5f. No log for the skip
    // itself; it's an expected, common state, not a failure.
    if (project.gcContactEmail) {
      const filename = buildPdfFilename({
        companyName: company.name,
        projectName: project.name,
        completedAt: meetingLog.completedAt,
        meetingLogId: meetingLog.id,
      });

      const pdfUrl = await storageService.getSignedUrl(
        PDF_BUCKET,
        path,
        EMAIL_PDF_URL_TTL_SECONDS,
        filename,
      );

      await emailService.sendMeetingLogEmail({
        to: project.gcContactEmail,
        projectName: project.name,
        companyName: company.name,
        pdfUrl,
        completedAt: meetingLog.completedAt,
      });
    }
  } catch (error) {
    console.error(
      `pdfGenerationQueue: failed to generate a PDF for meeting ${meetingLogId}`,
      error,
    );
  }
};

module.exports = { enqueue };
