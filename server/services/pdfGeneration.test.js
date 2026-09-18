// Plain CommonJS — no `import` (see vitest.config.js / CLAUDE.md). A pure
// function, so no mocking is needed: assertions run directly against the
// rendered PDF buffer's bytes.

const { renderMeetingLogPdf } = require("./pdfGeneration");

const meetingLog = {
  id: "meeting-1",
  projectId: "project-1",
  talkId: "talk-1",
  completedAt: "2026-09-18T12:00:00.000Z",
  crewPhotoUrl: "meeting-1/photo.jpg",
};

const project = {
  id: "project-1",
  name: "Downtown Highrise",
  gcNameCustom: "Acme GC",
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
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(startsWithPdfHeader(buffer)).toBe(true);
  });

  it("does not throw on a minimal fixture (no talk, no signatures, no crew photo)", async () => {
    const buffer = await renderMeetingLogPdf({
      meetingLog,
      project,
      talk: null,
      signatures: [],
    });

    expect(startsWithPdfHeader(buffer)).toBe(true);
  });

  it("includes the project name, talk title, and signer names in the rendered content", async () => {
    const buffer = await renderMeetingLogPdf({
      meetingLog,
      project,
      talk: talkWithAttributionAndQuiz,
      signatures,
    });
    const text = decodeRenderedText(buffer);

    expect(text).toContain("Downtown Highrise");
    expect(text).toContain("Fall Protection Basics");
    expect(text).toContain("Jane Doe");
    expect(text).toContain("John Smith");
  });

  it("prints the CPWR/NIOSH attribution copyright and notice when the talk has one", async () => {
    const buffer = await renderMeetingLogPdf({
      meetingLog,
      project,
      talk: talkWithAttributionAndQuiz,
      signatures,
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
    });
    const text = decodeRenderedText(buffer);

    expect(text).toContain("No crew photo on file");
  });
});
