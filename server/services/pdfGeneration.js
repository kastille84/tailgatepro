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
const QRCode = require("qrcode");
const { hasBrandingAccess } = require("../utility/entitlements");
const { formatDate } = require("../utility/formatDate");
const { shortSeal } = require("../utility/contentSeal");

const BODY_FONT = "Helvetica";
const BOLD_FONT = "Helvetica-Bold";
// Confirmed with the user — no production domain exists elsewhere in this
// codebase yet (pre-launch), this is the one place it's hardcoded.
const CTA_URL = "https://www.getTailgatePro.com";
const GC_SIGNUP_URL = `${CTA_URL}/signup`;
// Printed size (pt) of the verify QR code.
const QR_SIZE = 72;

// Brand navy for the tamper-evident mark (theme navy scale, hardcoded because a
// PDF has no CSS custom properties).
const SEAL_COLOR = "#1f3a5f";

// Vector "sealed" shield with a check, drawn with pdfkit paths so there is no
// image asset to ship. `size` is the printed width/height in pt; the shield is
// designed on a 24x24 grid and scaled. Leaves the cursor untouched.
const drawSealIcon = (doc, x, y, size) => {
  doc
    .save()
    .translate(x, y)
    .scale(size / 24)
    .path("M12 1 L22 5 V12 C22 18 17.5 22 12 24 C6.5 22 2 18 2 12 V5 Z")
    .fill(SEAL_COLOR)
    .path("M7 12.5 L10.5 16 L17 8.5")
    .lineWidth(2.4)
    .lineCap("round")
    .lineJoin("round")
    .stroke("white")
    .restore();
};

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
 * @param {object} params.meetingLog - `toMeetingLog` shape (heldAt, crewPhotoUrl, ...).
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
 * @param {string|null} [params.verifyUrl] - public `/verify/:id` page for this meeting. When
 *   set, a QR code and the plain URL are printed beside the content seal so a GC holding a paper
 *   or forwarded copy can check the file against the original.
 * @returns {Promise<Buffer>}
 */
const renderMeetingLogPdf = async ({
  meetingLog,
  project,
  talk,
  signatures,
  crewPhotoBuffer = null,
  company = null,
  logoBuffer = null,
  verifyUrl = null,
}) => {
  // Rendered before the pdfkit Promise below: QRCode.toBuffer is async, and
  // an awaited value inside the synchronous drawing code would force the
  // whole layout into callbacks.
  const qrBuffer = verifyUrl
    ? await QRCode.toBuffer(verifyUrl, { margin: 1, width: 240 })
    : null;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, compress: false });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Header
    // Company logo — Trade Pro+ only, and only once one's been uploaded (a
    // Pro+ company with no logo yet gets neither a logo nor the watermark
    // below, never a placeholder).
    if (hasBrandingAccess(company?.companyType, company?.tier) && logoBuffer) {
      ensureRoomFor(doc, 60);
      doc.image(logoBuffer, { fit: [120, 60] });
      doc.moveDown(0.5);
    }
    // Small tamper-evident mark at the top-right of page 1 so a reader sees the
    // report is sealed before reaching the footer. Positioned absolutely, so the
    // cursor is handed back to where the title starts.
    if (meetingLog.contentSeal) {
      const headerTop = doc.y;
      const markLeft = doc.page.width - doc.page.margins.right - 108;
      drawSealIcon(doc, markLeft, headerTop, 28);
      doc
        .font(BOLD_FONT)
        .fontSize(8)
        .fillColor(SEAL_COLOR)
        .text("TAMPER-EVIDENT", markLeft + 34, headerTop + 5, { lineBreak: false })
        .text("RECORD", markLeft + 34, headerTop + 15, { lineBreak: false });
      doc.fillColor("black");
      doc.x = doc.page.margins.left;
      doc.y = headerTop;
    }
    doc.fontSize(20).font(BOLD_FONT).text("Toolbox Talk Safety Meeting Report");
    doc.font(BODY_FONT);
    doc.moveDown();
    doc.fontSize(12);
    labelLine(doc, "Subcontractor", company?.name ?? "Unknown");
    labelLine(doc, "Project", project.name);
    labelLine(doc, "General contractor", project.gcNameCustom ?? "N/A");
    labelLine(doc, "Talk", talk?.title ?? "Untitled talk");
    // The meeting's own time (client-reported, see utility/heldAt.js), not the
    // server-receipt `completedAt`. The "Generated" footer below is server
    // time (this runs synchronously inside complete()), so an offline meeting
    // synced later shows both.
    labelLine(doc, "Meeting held", formatDate(meetingLog.heldAt, meetingLog.heldTzOffset));

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

    // Liability disclaimer (client/src/pages/Legal/Terms.tsx §3 has the full
    // wording). Printed on every report, regardless of plan.
    doc
      .moveDown(0.5)
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#555555")
      .text(
        "This record is for informational and record-keeping purposes only. " +
          "TailgatePro does not provide legal advice and does not guarantee " +
          "OSHA compliance or protection from citations, injury claims, or lawsuits.",
      );
    doc.fillColor("black");

    // Tamper-evidence seal (Phase 9e, docs/tamper-evidence-design.md): a
    // short, human-eyeballable fragment of the full HMAC-SHA256 seal stored
    // on meeting_logs.content_seal. This fragment is not itself checked
    // against anything — it's a printed receipt for a human to compare by
    // eye; real verification always goes through
    // GET /api/meetings/:id/verify-seal (or the GC-side equivalent), which
    // recomputes the full digest server-side. Absent for any meeting
    // completed before this shipped (content_seal is null, not backfilled).
    if (meetingLog.contentSeal) {
      // Icon + headline + one-line explanation, kept together on one page.
      const SEAL_ICON_SIZE = 40;
      ensureRoomFor(doc, SEAL_ICON_SIZE + 16);
      doc.moveDown(0.5);
      const sealTop = doc.y;
      const textLeft = doc.page.margins.left + SEAL_ICON_SIZE + 10;
      const textWidth =
        doc.page.width - doc.page.margins.right - textLeft;
      drawSealIcon(doc, doc.page.margins.left, sealTop, SEAL_ICON_SIZE);
      doc
        .font(BOLD_FONT)
        .fontSize(11)
        .fillColor(SEAL_COLOR)
        .text("TAMPER-EVIDENT RECORD", textLeft, sealTop + 2, { width: textWidth });
      doc
        .font(BODY_FONT)
        .fontSize(8)
        .fillColor("#555555")
        .text(
          "Sealed by TailgatePro when this meeting was completed. Any later change to the record or to this file can be detected.",
          { width: textWidth },
        )
        .text(`Content seal: ${shortSeal(meetingLog.contentSeal)}`, { width: textWidth });
      doc.fillColor("black");
      doc.x = doc.page.margins.left;
      doc.y = Math.max(doc.y, sealTop + SEAL_ICON_SIZE) + 6;
    }

    // Verify-this-file QR (PDF-byte tamper evidence,
    // docs/tamper-evidence-design.md): points at the public /verify/:id page,
    // where the reader drops this file to compare its SHA-256 against the one
    // recorded at render time. QR image + URL are kept together on one page.
    if (qrBuffer) {
      ensureRoomFor(doc, QR_SIZE + 30);
      doc.moveDown(0.5);
      const qrTop = doc.y;
      doc.image(qrBuffer, doc.page.margins.left, qrTop, { fit: [QR_SIZE, QR_SIZE] });
      doc
        .fontSize(8)
        .fillColor("#555555")
        .text(
          "Scan to verify this report is unaltered, or open:",
          doc.page.margins.left + QR_SIZE + 10,
          qrTop + 8,
        )
        .text(verifyUrl, { link: verifyUrl, underline: true });
      doc.fillColor("black");
      // Text above is positioned absolutely; hand the cursor back below the
      // QR so the sections that follow don't overlap it.
      doc.x = doc.page.margins.left;
      doc.y = qrTop + QR_SIZE + 6;
    }

    // Static free-tier watermark (docs/pricing-and-positioning-strategy_V2.md:
    // Trade Free PDFs carry this, Trade Pro+ removes it and adds the
    // company's own logo instead — gated on
    // hasBrandingAccess(company?.companyType, company?.tier) alone,
    // independent of whether a logo has actually been uploaded, so a
    // paying Pro+ company never sees a "Free plan" watermark on its own
    // report just because it hasn't uploaded a logo yet). Uses pdfkit's
    // built-in Helvetica-Oblique standard font, no font file to embed.
    if (!hasBrandingAccess(company?.companyType, company?.tier)) {
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
        "Are you the General Contractor on this project?",
      );
    doc
      .font(BODY_FONT)
      .fontSize(10)
      .text(
        "Track site-wide safety compliance across all your trades for free " +
          "— every subcontractor's toolbox talks, signatures, and compliance " +
          "status in one dashboard.",
      );
    doc.moveDown();
    doc
      .font(BOLD_FONT)
      .fillColor("#1a56db")
      .text("Claim Your Free GC Portal", {
        link: GC_SIGNUP_URL,
        underline: true,
      });

    doc.end();
  });
};

module.exports = { renderMeetingLogPdf, ensureRoomFor };
