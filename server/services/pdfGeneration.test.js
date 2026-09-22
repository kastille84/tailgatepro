// Plain CommonJS — no `import` (see vitest.config.js / CLAUDE.md). A pure
// function, so no mocking is needed: assertions run directly against the
// rendered PDF buffer's bytes.

const { renderMeetingLogPdf, ensureRoomFor } = require("./pdfGeneration");

const meetingLog = {
  id: "meeting-1",
  projectId: "project-1",
  talkId: "talk-1",
  // Held Sept 18; the completion reached the server (completedAt) the next
  // morning. The two differ so tests can prove the header prints heldAt.
  heldAt: "2026-09-18T12:00:00.000Z",
  completedAt: "2026-09-19T06:15:00.000Z",
  crewPhotoUrl: "meeting-1/photo.jpg",
};

const project = {
  id: "project-1",
  name: "Downtown Highrise",
  gcNameCustom: "Acme GC",
};

const company = {
  id: "company-1",
  name: "Acme Roofing",
  companyType: "subcontractor",
  tier: "basic",
};

const talkWithAttributionAndQuiz = {
  id: "talk-1",
  title: "Fall Protection Basics",
  structured: {
    summary: "Fall protection prevents the leading cause of construction deaths.",
    talking_points: ["Inspect harnesses before use", "Tie off at 6 feet"],
    site_hazards_to_check: ["Unprotected edges", "Missing guardrails"],
    discussion_questions: ["Where are today's fall hazards on this site?"],
  },
  attribution: {
    copyright: "© 2017 CPWR — The Center for Construction Research and Training.",
    notice: "Reproduced with attribution; not an endorsement by CPWR or NIOSH.",
  },
  quiz: [
    { question: "q1", choices: ["a", "b"], correctIndex: 0 },
    { question: "q2", choices: ["a", "b"], correctIndex: 1 },
  ],
};

const signatures = [
  { workerName: "Jane Doe", quizScore: 2, quizPassed: true },
  { workerName: "John Smith", quizScore: 1, quizPassed: false },
];

// A real, minimal, valid 1x1 PNG (well-known test fixture bytes) — needed
// because pdfkit's doc.image() inspects the buffer's actual header to
// determine the image format, so an arbitrary Buffer won't do.
const minimalPngBuffer = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

const startsWithPdfHeader = (buffer) => buffer.slice(0, 5).toString("latin1") === "%PDF-";

// pdfkit renders text as hex-encoded glyph runs inside TJ arrays (kerning
// pairs split a string into multiple `<hex>` runs joined by numeric
// positioning offsets — not literal parenthesized strings), so a plain
// `buffer.toString().includes(...)` never matches rendered text. This
// decodes every hex run in the raw PDF bytes back to ASCII and concatenates
// them (kerning splits fall mid-word/mid-phrase, not at gaps that need a
// separator reinserted) so tests can assert against rendered content
// directly, the same way a human reading the PDF would see it.
const decodeRenderedText = (buffer) => {
  const raw = buffer.toString("latin1");
  const hexRuns = raw.match(/<[0-9a-fA-F]+>/g) ?? [];
  return hexRuns
    .map((run) => {
      const hex = run.slice(1, -1);
      let out = "";
      for (let i = 0; i + 1 < hex.length; i += 2) {
        out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
      }
      return out;
    })
    .join("");
};

describe("pdfGeneration: renderMeetingLogPdf", () => {
  it("returns a Buffer starting with the %PDF- header for a full fixture", async () => {
    const buffer = await renderMeetingLogPdf({
      meetingLog,
      project,
      talk: talkWithAttributionAndQuiz,
      signatures,
      crewPhotoBuffer: null,
      company,
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(startsWithPdfHeader(buffer)).toBe(true);
  });

  it("does not throw on a minimal fixture (no talk, no signatures, no crew photo, no company)", async () => {
    const buffer = await renderMeetingLogPdf({
      meetingLog,
      project,
      talk: null,
      signatures: [],
    });

    expect(startsWithPdfHeader(buffer)).toBe(true);
  });

  it("includes the subcontractor company, project name, talk title, and signer names in the rendered content", async () => {
    const buffer = await renderMeetingLogPdf({
      meetingLog,
      project,
      talk: talkWithAttributionAndQuiz,
      signatures,
      company,
    });
    const text = decodeRenderedText(buffer);

    expect(text).toContain("Acme Roofing");
    expect(text).toContain("Downtown Highrise");
    expect(text).toContain("Fall Protection Basics");
    expect(text).toContain("Jane Doe");
    expect(text).toContain("John Smith");
  });

  it("renders bulleted talking points, hazards, and discussion questions", async () => {
    const buffer = await renderMeetingLogPdf({
      meetingLog,
      project,
      talk: talkWithAttributionAndQuiz,
      signatures,
      company,
    });
    const text = decodeRenderedText(buffer);

    expect(text).toContain("Inspect harnesses before use");
    expect(text).toContain("Unprotected edges");
    expect(text).toContain("Where are today's fall hazards on this site?");
  });

  it("prints a GC marketing call-to-action with a clickable link to TailgatePro", async () => {
    const buffer = await renderMeetingLogPdf({
      meetingLog,
      project,
      talk: talkWithAttributionAndQuiz,
      signatures,
      company,
    });
    const text = decodeRenderedText(buffer);
    const raw = buffer.toString("latin1");

    expect(text).toContain(
      "GC's, are you receiving many safety reports like this from multiple subcontractors?",
    );
    expect(text).toContain("Try TailgatePro free at getTailgatePro.com");
    // A link annotation's URI is stored as a literal string in the PDF
    // object, not hex-encoded glyph runs like the visible text — assertable
    // directly against the raw buffer.
    expect(raw).toContain("https://www.getTailgatePro.com");
  });

  it("falls back to 'Unknown' for the subcontractor when no company is given", async () => {
    const buffer = await renderMeetingLogPdf({
      meetingLog,
      project,
      talk: talkWithAttributionAndQuiz,
      signatures,
    });
    const text = decodeRenderedText(buffer);

    expect(text).toContain("Unknown");
  });

  it("prints when the meeting was held in a human-readable form, not the raw ISO timestamp", async () => {
    const buffer = await renderMeetingLogPdf({
      meetingLog,
      project,
      talk: talkWithAttributionAndQuiz,
      signatures,
      company,
    });
    const text = decodeRenderedText(buffer);

    expect(text).toContain("Meeting held");
    expect(text).toContain("September 18, 2026 at 12:00 PM UTC");
    expect(text).not.toContain("2026-09-18T12:00:00.000Z");
  });

  it("prints the held time, not the later server-receipt time, and keeps the 'Generated' footer as the server-side stamp", async () => {
    const buffer = await renderMeetingLogPdf({
      meetingLog,
      project,
      talk: talkWithAttributionAndQuiz,
      signatures,
      company,
    });
    const text = decodeRenderedText(buffer);

    // completedAt (Sept 19, 6:15 AM) is the audit stamp and must not be
    // presented as when the meeting happened.
    expect(text).not.toContain("September 19, 2026 at 6:15 AM UTC");
    expect(text).not.toContain("Completed");
    expect(text).toContain("Generated");
  });

  it("prints the CPWR/NIOSH attribution copyright and notice when the talk has one", async () => {
    const buffer = await renderMeetingLogPdf({
      meetingLog,
      project,
      talk: talkWithAttributionAndQuiz,
      signatures,
      company,
    });
    const text = decodeRenderedText(buffer);

    expect(text).toContain("CPWR");
    expect(text).toContain("not an endorsement by CPWR or NIOSH");
  });

  it("omits attribution text entirely when the talk has none", async () => {
    const buffer = await renderMeetingLogPdf({
      meetingLog,
      project,
      talk: { ...talkWithAttributionAndQuiz, attribution: null },
      signatures,
      company,
    });
    const text = decodeRenderedText(buffer);

    expect(text).not.toContain("not an endorsement");
  });

  it("prints quiz pass/fail per signer when the talk has a quiz", async () => {
    const buffer = await renderMeetingLogPdf({
      meetingLog,
      project,
      talk: talkWithAttributionAndQuiz,
      signatures,
      company,
    });
    const text = decodeRenderedText(buffer);

    expect(text).toContain("Quiz: 2/2 (Passed)");
    expect(text).toContain("Quiz: 1/2 (Failed)");
  });

  it("omits quiz wording entirely when the talk has no quiz", async () => {
    const buffer = await renderMeetingLogPdf({
      meetingLog,
      project,
      talk: { ...talkWithAttributionAndQuiz, quiz: null },
      signatures,
      company,
    });
    const text = decodeRenderedText(buffer);

    expect(text).not.toContain("Quiz:");
  });

  it("falls back to a 'No crew photo on file' note when no crewPhotoBuffer is given", async () => {
    const buffer = await renderMeetingLogPdf({
      meetingLog,
      project,
      talk: talkWithAttributionAndQuiz,
      signatures,
      company,
    });
    const text = decodeRenderedText(buffer);

    expect(text).toContain("No crew photo on file");
  });

  it("embeds a signer's signature image when one is given, without throwing", async () => {
    const buffer = await renderMeetingLogPdf({
      meetingLog,
      project,
      talk: talkWithAttributionAndQuiz,
      signatures: [{ ...signatures[0], imageBuffer: minimalPngBuffer }],
      company,
    });

    expect(startsWithPdfHeader(buffer)).toBe(true);
  });

  it("prints a '(signature image unavailable)' note for a signer with no image", async () => {
    const buffer = await renderMeetingLogPdf({
      meetingLog,
      project,
      talk: talkWithAttributionAndQuiz,
      signatures: [{ ...signatures[0], imageBuffer: null }],
      company,
    });
    const text = decodeRenderedText(buffer);

    expect(text).toContain("(signature image unavailable)");
  });

  it("prints the free-tier watermark footer for a basic-tier company", async () => {
    const buffer = await renderMeetingLogPdf({
      meetingLog,
      project,
      talk: talkWithAttributionAndQuiz,
      signatures,
      company,
    });
    const text = decodeRenderedText(buffer);

    expect(text).toContain("Logged via TailgatePro");
    expect(text).toContain("upgrade to Trade Pro");
  });

  it("prints the free-tier watermark footer when no company is given", async () => {
    const buffer = await renderMeetingLogPdf({
      meetingLog,
      project,
      talk: talkWithAttributionAndQuiz,
      signatures,
    });
    const text = decodeRenderedText(buffer);

    expect(text).toContain("Logged via TailgatePro");
  });

  it.each(["premium", "enterprise"])(
    "omits the free-tier watermark footer for a %s-tier company",
    async (tier) => {
      const buffer = await renderMeetingLogPdf({
        meetingLog,
        project,
        talk: talkWithAttributionAndQuiz,
        signatures,
        company: { ...company, tier },
      });
      const text = decodeRenderedText(buffer);

      expect(text).not.toContain("Logged via TailgatePro");
      expect(text).not.toContain("upgrade to Trade Pro");
    },
  );

  it("embeds the company logo for a Pro+ company when a logoBuffer is given, without throwing", async () => {
    const buffer = await renderMeetingLogPdf({
      meetingLog,
      project,
      talk: talkWithAttributionAndQuiz,
      signatures,
      company: { ...company, tier: "premium" },
      logoBuffer: minimalPngBuffer,
    });

    expect(startsWithPdfHeader(buffer)).toBe(true);
  });

  it("renders neither a logo nor the watermark for a Pro+ company with no logo uploaded yet", async () => {
    const buffer = await renderMeetingLogPdf({
      meetingLog,
      project,
      talk: talkWithAttributionAndQuiz,
      signatures,
      company: { ...company, tier: "premium" },
      logoBuffer: null,
    });
    const text = decodeRenderedText(buffer);

    expect(text).not.toContain("Logged via TailgatePro");
    expect(startsWithPdfHeader(buffer)).toBe(true);
  });

  it("does not embed a logo for a basic-tier company even if a logoBuffer is given", async () => {
    const buffer = await renderMeetingLogPdf({
      meetingLog,
      project,
      talk: talkWithAttributionAndQuiz,
      signatures,
      company,
      logoBuffer: minimalPngBuffer,
    });
    const text = decodeRenderedText(buffer);

    expect(text).toContain("Logged via TailgatePro");
  });

  it("flows content across multiple pages instead of clipping when the document is long", async () => {
    const manySignatures = Array.from({ length: 6 }, (_, i) => ({
      workerName: `Worker ${i + 1}`,
      quizScore: 2,
      quizPassed: true,
      imageBuffer: minimalPngBuffer,
    }));

    const buffer = await renderMeetingLogPdf({
      meetingLog,
      project,
      talk: talkWithAttributionAndQuiz,
      signatures: manySignatures,
      crewPhotoBuffer: minimalPngBuffer,
      company,
    });
    const raw = buffer.toString("latin1");
    // Counts actual page objects (`/Type /Page`), not the `/Type /Pages`
    // tree node — `\b` after "Page" doesn't match the "s" in "Pages".
    const pageObjectCount = (raw.match(/\/Type\s*\/Page\b/g) ?? []).length;

    expect(pageObjectCount).toBeGreaterThan(1);
  });
});

describe("pdfGeneration: ensureRoomFor", () => {
  const makeDoc = (y, { pageHeight = 792, bottomMargin = 50 } = {}) => ({
    y,
    page: { height: pageHeight, margins: { bottom: bottomMargin } },
    addPage: vi.fn(),
  });

  it("does not add a page when there is enough remaining room", () => {
    const doc = makeDoc(400); // remaining = 792 - 50 - 400 = 342

    ensureRoomFor(doc, 300);

    expect(doc.addPage).not.toHaveBeenCalled();
  });

  it("adds a page when the needed height exceeds the remaining room", () => {
    const doc = makeDoc(700); // remaining = 792 - 50 - 700 = 42

    ensureRoomFor(doc, 300);

    expect(doc.addPage).toHaveBeenCalledTimes(1);
  });

  it("does not add a page when the needed height exactly equals the remaining room", () => {
    const doc = makeDoc(792 - 50 - 300); // remaining exactly 300

    ensureRoomFor(doc, 300);

    expect(doc.addPage).not.toHaveBeenCalled();
  });
});
