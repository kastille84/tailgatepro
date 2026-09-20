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
const { hasBrandingAccess } = require("../utility/entitlements");
const { formatDate } = require("../utility/formatDate");

const BODY_FONT = "Helvetica";
const BOLD_FONT = "Helvetica-Bold";
// Confirmed with the user — no production domain exists elsewhere in this
// codebase yet (pre-launch), this is the one place it's hardcoded.
const CTA_URL = "https://www.getTailgatePro.com";

// pdfkit auto-paginates wrapped text (checks remaining page height and
// calls addPage() internally) but not images — an image near the bottom of
// a page just gets clipped at the boundary instead of flowing to the next
// page. This reserves room up front so that never happens. Exported for
// direct unit testing (fake `doc` object) since page-layout math isn't
// practically assertable from decoded PDF text the way the rest of this
// file's tests work.
const ensureRoomFor = (doc, height) => {
  const remaining = doc.page.height - doc.page.margins.bottom - doc.y;
  if (remaining < height) {
    doc.addPage();
  }
};

// Prints "Label: value" — a bold label immediately followed by a
// normal-weight value on the same line (`continued: true`).
const labelLine = (doc, label, value) => {
  doc.font(BOLD_FONT).text(`${label}: `, { continued: true });
  doc.font(BODY_FONT).text(value);
};

// Prints a bold section heading, then resets back to the regular body font
// — pdfkit's font is stateful (persists until changed again), so skipping
// this reset would silently bold whatever text follows.
const heading = (doc, text, size = 14) => {
  doc.fontSize(size).font(BOLD_FONT).text(text);
  doc.font(BODY_FONT);
};

const bulletList = (doc, headingText, items) => {
  if (!Array.isArray(items) || items.length === 0) return;
  doc.moveDown(0.5);
  heading(doc, headingText);
  doc.fontSize(11);
  items.forEach((item) =>
    // indentAllLines so a wrapped long item's continuation lines stay
    // aligned under the bullet instead of snapping back to the left margin.
    doc.text(`• ${item}`, { indent: 20, indentAllLines: true }),
  );
};

/**
 * Renders a completed meeting log into a PDF buffer.
 * @param {object} params
 * @param {object} params.meetingLog - `toMeetingLog` shape (completedAt, crewPhotoUrl, ...).
 * @param {object} params.project - `toProject` shape (name, gcNameCustom, ...).
 * @param {object|null} params.talk - `toTalk` shape (title, structured, attribution, quiz), or
 *   `null` if the meeting's talk was detached (meeting_logs.talk_id is ON DELETE SET NULL).
 * @param {object[]} params.signatures - `toSignature` shape array (workerName, quizScore, ...),
 *   each optionally carrying an `imageBuffer` (`Buffer|null`, pre-fetched signature PNG bytes,
 *   attached by the caller — this function does no Storage I/O itself).
 * @param {Buffer|null} [params.crewPhotoBuffer] - pre-fetched crew photo bytes, or `null` if none
 *   was uploaded / the caller chose not to embed it. This function does no Storage I/O itself.
 * @param {object|null} [params.company] - `toCompany` shape (name, tier, ...) for the reporting
 *   subcontractor, or `null` if unavailable.
 * @param {Buffer|null} [params.logoBuffer] - pre-fetched company logo bytes, or `null` if the
 *   company has no logo uploaded (or isn't Trade Pro+). This function does no Storage I/O itself.
 * @returns {Promise<Buffer>}
 */
const renderMeetingLogPdf = ({
  meetingLog,
  project,
  talk,
  signatures,
  crewPhotoBuffer = null,
  company = null,
  logoBuffer = null,
}) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, compress: false });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Header
    // Company logo — Trade Pro+ only, and only once one's been uploaded (a
    // Pro+ company with no logo yet gets neither a logo nor the watermark
    // below, never a placeholder).
    if (hasBrandingAccess(company?.tier) && logoBuffer) {
      ensureRoomFor(doc, 60);
      doc.image(logoBuffer, { fit: [120, 60] });
      doc.moveDown(0.5);
    }
    doc.fontSize(20).font(BOLD_FONT).text("Toolbox Talk Safety Meeting Report");
    doc.font(BODY_FONT);
    doc.moveDown();
    doc.fontSize(12);
    labelLine(doc, "Subcontractor", company?.name ?? "Unknown");
    labelLine(doc, "Project", project.name);
    labelLine(doc, "General contractor", project.gcNameCustom ?? "N/A");
    labelLine(doc, "Talk", talk?.title ?? "Untitled talk");
    labelLine(doc, "Completed", formatDate(meetingLog.completedAt));

    // Talk content
    if (talk?.structured?.summary) {
      doc.moveDown();
      heading(doc, "Summary");
      doc.fontSize(11).text(talk.structured.summary);
    }
    bulletList(doc, "Talking points", talk?.structured?.talking_points);
    bulletList(
      doc,
      "Hazards to check on site",
      talk?.structured?.site_hazards_to_check,
    );
    bulletList(
      doc,
      "Discussion questions",
      talk?.structured?.discussion_questions,
    );

    // Attribution — CPWR/NIOSH licensing requirement (docs/content-attribution.md):
    // the Phase 5 PDF service must print the same credit shown in-app.
    if (talk?.attribution) {
      doc.moveDown().fontSize(9);
      if (talk.attribution.copyright) doc.text(talk.attribution.copyright);
      if (talk.attribution.notice) doc.text(talk.attribution.notice);
    }

    // Signer list
    doc.moveDown();
    heading(doc, "Attendance & signatures");
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
      if (signature.imageBuffer) {
        ensureRoomFor(doc, 80);
        doc.image(signature.imageBuffer, { fit: [200, 80] });
      } else {
        doc.text("(signature image unavailable)");
      }
      doc.moveDown(0.5);
    });

    // Crew photo
    if (crewPhotoBuffer) {
      ensureRoomFor(doc, 320); // heading + image, kept together on one page
    }
    doc.moveDown();
    heading(doc, "Crew photo");
    if (crewPhotoBuffer) {
      doc.image(crewPhotoBuffer, { fit: [300, 300] });
    } else {
      doc.fontSize(11).text("No crew photo on file.");
    }

    // Footer
    doc
      .moveDown()
      .fontSize(9)
      .text(`Generated ${formatDate(new Date().toISOString())}`);

    // Static free-tier watermark (docs/pricing-and-positioning-strategy_V2.md:
    // Trade Free PDFs carry this, Trade Pro+ removes it and adds the
    // company's own logo instead — gated on hasBrandingAccess(company?.tier)
    // alone, independent of whether a logo has actually been uploaded, so a
    // paying Pro+ company never sees a "Free plan" watermark on its own
    // report just because it hasn't uploaded a logo yet). Uses pdfkit's
    // built-in Helvetica-Oblique standard font, no font file to embed.
    if (!hasBrandingAccess(company?.tier)) {
      doc
        .moveDown(0.5)
        .font("Helvetica-Oblique")
        .fontSize(9)
        .fillColor("red")
        .text(
          "Logged via TailgatePro (Free plan) — upgrade to Trade Pro to remove this watermark and add your company logo.",
          {
            link: CTA_URL,
            underline: true,
          },
        );
    }

    // GC growth CTA. This report often reaches a GC who has never used
    // TailgatePro at all — the subcontractor is the one with an account,
    // the GC is just the recipient — so this closes the document with a
    // brief, separate pitch aimed at whoever is reading it, distinct from
    // the free-tier watermark above (which is aimed at the paying
    // subcontractor about their own plan). Plain text only, no image, so it
    // auto-paginates fine on its own — no ensureRoomFor needed.
    doc.moveDown();
    doc
      .strokeColor("#cccccc")
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .stroke();
    doc.moveDown();
    doc
      .font(BOLD_FONT)
      .fontSize(11)
      .fillColor("black") // reset — the watermark line above left fillColor as gray
      .text(
        "GC's, are you receiving many safety reports like this from multiple subcontractors?",
      );
    doc
      .font(BODY_FONT)
      .fontSize(10)
      .text(
        "TailgatePro gives general contractors one dashboard to track every " +
          "subcontractor's toolbox talks, signatures, and compliance status " +
          "— no more chasing paper.",
      );
    doc.moveDown();
    doc
      .font(BOLD_FONT)
      .fillColor("#1a56db")
      .text("Try TailgatePro free at getTailgatePro.com", {
        link: CTA_URL,
        underline: true,
      });

    doc.end();
  });

module.exports = { renderMeetingLogPdf, ensureRoomFor };
