// Pure, I/O-free PDF renderer for a completed meeting log. No Supabase, no
// Express, no fetch — CJS to match the rest of the server. Orchestration
// (fetching the meeting/project/talk/signatures rows, downloading the crew
// photo blob, uploading the result, and emailing it) is pdfGenerationQueue.js's
// job, not this file's. See docs/meeting-flow-design.md's "Phase 5 hook
// point" section for the design decisions this implements.
//
// `compress: false` is deliberate: it keeps the generated PDF's text content
// greppable in the raw output buffer for structural tests, at the cost of a
// slightly larger file — an acceptable trade for a single meeting-log
// document.

const PDFDocument = require("pdfkit");

const formatDate = (isoString) => {
  if (!isoString) return "Unknown";
  const date = new Date(isoString);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toISOString();
};

const bulletList = (doc, heading, items) => {
  if (!Array.isArray(items) || items.length === 0) return;
  doc.moveDown(0.5).fontSize(14).text(heading);
  doc.fontSize(11);
  items.forEach((item) => doc.text(`• ${item}`));
};

/**
 * Renders a completed meeting log into a PDF buffer.
 * @param {object} params
 * @param {object} params.meetingLog - `toMeetingLog` shape (completedAt, crewPhotoUrl, ...).
 * @param {object} params.project - `toProject` shape (name, gcNameCustom, ...).
 * @param {object|null} params.talk - `toTalk` shape (title, structured, attribution, quiz), or
 *   `null` if the meeting's talk was detached (meeting_logs.talk_id is ON DELETE SET NULL).
 * @param {object[]} params.signatures - `toSignature` shape array (workerName, quizScore, ...).
 * @param {Buffer|null} [params.crewPhotoBuffer] - pre-fetched crew photo bytes, or `null` if none
 *   was uploaded / the caller chose not to embed it. This function does no Storage I/O itself.
 * @returns {Promise<Buffer>}
 */
const renderMeetingLogPdf = ({
  meetingLog,
  project,
  talk,
  signatures,
  crewPhotoBuffer = null,
}) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, compress: false });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Header
    doc.fontSize(20).text("Toolbox Talk Safety Meeting Report");
    doc.moveDown();
    doc.fontSize(12);
    doc.text(`Project: ${project.name}`);
    doc.text(`General contractor: ${project.gcNameCustom ?? "N/A"}`);
    doc.text(`Talk: ${talk?.title ?? "Untitled talk"}`);
    doc.text(`Completed: ${formatDate(meetingLog.completedAt)}`);

    // Talk content
    if (talk?.structured?.summary) {
      doc.moveDown().fontSize(14).text("Summary");
      doc.fontSize(11).text(talk.structured.summary);
    }
    bulletList(doc, "Talking points", talk?.structured?.talking_points);
    bulletList(
      doc,
      "Hazards to check on site",
      talk?.structured?.site_hazards_to_check,
    );
    bulletList(doc, "Discussion questions", talk?.structured?.discussion_questions);

    // Attribution — CPWR/NIOSH licensing requirement (docs/content-attribution.md):
    // the Phase 5 PDF service must print the same credit shown in-app.
    if (talk?.attribution) {
      doc.moveDown().fontSize(9);
      if (talk.attribution.copyright) doc.text(talk.attribution.copyright);
      if (talk.attribution.notice) doc.text(talk.attribution.notice);
    }

    // Signer list
    doc.moveDown().fontSize(14).text("Attendance & signatures");
    doc.fontSize(11);
    const quiz = talk?.quiz;
    (signatures ?? []).forEach((signature) => {
      const quizNote =
        Array.isArray(quiz) && quiz.length > 0
          ? ` — Quiz: ${signature.quizScore}/${quiz.length} (${
              signature.quizPassed ? "Passed" : "Failed"
            })`
          : "";
      doc.text(`${signature.workerName}${quizNote}`);
    });

    // Crew photo
    doc.moveDown().fontSize(14).text("Crew photo");
    if (crewPhotoBuffer) {
      doc.image(crewPhotoBuffer, { fit: [300, 300] });
    } else {
      doc.fontSize(11).text("No crew photo on file.");
    }

    // Footer
    doc.moveDown().fontSize(9).text(`Generated ${new Date().toISOString()}`);

    doc.end();
  });

module.exports = { renderMeetingLogPdf };
