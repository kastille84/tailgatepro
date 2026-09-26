// Plain CommonJS — no `import` (see vitest.config.js / CLAUDE.md). Vitest
// exposes describe/it/expect as globals.

const fs = require("fs");
const path = require("path");

const {
  readDocxText,
  xmlToText,
  parseTalks,
  bodyHash,
  slugify,
  rawFileName,
  toRawMarkdown,
  groupsFor,
  findDuplicateCandidates,
} = require("./parseToolboxDocx");

const DOCX = path.join(__dirname, "..", "..", "data", "300_Toolbox_Talks_Library.docx");

const page = (num, title, why = "It matters.") =>
  [
    `TBT-${num}  ${title}`,
    "Category: Health, Safety & Environmental Briefing      Duration: 5–10 minutes",
    `Why It Matters: ${title} ${why}`,
    "KEY HAZARDS",
    "• Falls",
    "• cuts",
    "REQUIRED CONTROLS",
    "• Inspect gear",
    "EMPLOYEES MUST",
    "• Wear PPE",
    "EMPLOYEES MUST NOT",
    "• Take shortcuts",
    "GOOD PRACTICE",
    "• Plan ahead",
    "EMERGENCY / INCIDENT RESPONSE",
    "• Call 911",
    "Supervisor Discussion",
    `What are the hazards of ${title}?`,
    "Presenter",
    "Date",
    "Document control: TBT Library | Revision 2.0",
  ].join("\n");

describe("xmlToText", () => {
  it("puts paragraphs on their own lines and decodes entities", () => {
    const xml = "<w:p><w:r><w:t>A &amp; B</w:t></w:r></w:p><w:p><w:r><w:t>it&apos;s</w:t></w:r></w:p>";
    expect(xmlToText(xml)).toBe("A & B\nit's\n");
  });

  it("decodes numeric entities", () => {
    expect(xmlToText("<w:t>&#8226; &#x2013;</w:t>")).toBe("• –");
  });
});

describe("parseTalks", () => {
  it("skips table-of-contents entries and parses every section", () => {
    const text = [
      "Contents",
      "TBT-001  Ladder Safety",
      "TBT-002  Hot Work",
      "",
      page("001", "Ladder Safety"),
      "",
      page("002", "Hot Work"),
    ].join("\n");

    const talks = parseTalks(text);

    expect(talks.map((t) => t.number)).toEqual(["001", "002"]);
    expect(talks[0]).toMatchObject({
      title: "Ladder Safety",
      category: "Health, Safety & Environmental Briefing",
      duration: "5–10 minutes",
      keyHazards: ["Falls", "cuts"],
      requiredControls: ["Inspect gear"],
      employeesMust: ["Wear PPE"],
      employeesMustNot: ["Take shortcuts"],
      goodPractice: ["Plan ahead"],
      emergencyResponse: ["Call 911"],
    });
    expect(talks[0].supervisorDiscussion).toEqual(["What are the hazards of Ladder Safety?"]);
  });

  it("does not leak the sign-off table into the last section", () => {
    const [talk] = parseTalks(page("001", "Ladder Safety"));
    expect(talk.supervisorDiscussion).toHaveLength(1);
  });

  it("returns nothing for text with no talk pages", () => {
    expect(parseTalks("TBT-001  Only In Contents\n")).toEqual([]);
  });

  it("falls back when the Category line has no Duration", () => {
    const [talk] = parseTalks("TBT-001  X\nCategory: Just This\nWhy It Matters: y");
    expect(talk.category).toBe("Just This");
    expect(talk.duration).toBe("");
  });
});

describe("bodyHash", () => {
  it("is equal for talks that differ only by title", () => {
    const [a] = parseTalks(page("004", "Ladder Safety"));
    const [b] = parseTalks(page("005", "Mobile Towers"));
    expect(bodyHash(a)).toBe(bodyHash(b));
  });

  it("differs when the body differs", () => {
    const [a] = parseTalks(page("004", "Ladder Safety"));
    const [b] = parseTalks(page("005", "Mobile Towers", "It is different."));
    expect(bodyHash(a)).not.toBe(bodyHash(b));
  });
});

describe("slugify / rawFileName", () => {
  it("kebab-cases titles with punctuation", () => {
    expect(slugify("PPE: Selection, Use and Care")).toBe("ppe-selection-use-and-care");
    expect(slugify("Lockout/Tagout")).toBe("lockout-tagout");
    expect(slugify("Health & Safety")).toBe("health-and-safety");
  });

  it("prefixes the TBT number", () => {
    expect(rawFileName({ number: "004", title: "Ladder Safety" })).toBe("tbt-004-ladder-safety.md");
  });
});

describe("toRawMarkdown", () => {
  it("carries frontmatter and every section", () => {
    const [talk] = parseTalks(page("004", "Ladder Safety"));
    const md = toRawMarkdown(talk, {
      sourcePath: "data/x.docx",
      scrapedDate: "2026-09-25T00:00:00Z",
      hash: "abc",
    });
    expect(md).toContain("agency: Owner-Provided");
    expect(md).toContain("tbt_number: TBT-004");
    expect(md).toContain("body_hash: abc");
    for (const h of ["Why It Matters", "KEY HAZARDS", "REQUIRED CONTROLS", "EMPLOYEES MUST NOT", "GOOD PRACTICE", "EMERGENCY / INCIDENT RESPONSE", "Supervisor Discussion"]) {
      expect(md).toContain(`## ${h}`);
    }
    expect(md).toContain("- Inspect gear");
  });
});

describe("findDuplicateCandidates", () => {
  const existing = [
    { id: "falls-extension-ladders", title: "Extension Ladder Fall Prevention" },
    { id: "silica", title: "Controlling Silica Dust Exposure" },
  ];

  it("groups topics from titles", () => {
    expect(groupsFor("Ladder Safety")).toContain("ladder");
    expect(groupsFor("Silica Dust")).toContain("silica");
  });

  it("matches new talks to existing ones by topic and reports identical bodies", () => {
    const talks = parseTalks(
      [page("004", "Ladder Safety"), page("005", "Mobile Towers"), page("119", "Silica Dust")].join("\n")
    );
    const result = findDuplicateCandidates(talks, existing);

    expect(result.vsExisting.map((r) => r.tbt)).toEqual(["TBT-004", "TBT-119"]);
    expect(result.vsExisting[0].matches[0].id).toBe("falls-extension-ladders");
    expect(result.identicalBodies[0].members).toEqual(["TBT-004", "TBT-005", "TBT-119"]);
  });

  it("flags within-import topic overlap", () => {
    const talks = parseTalks([page("017", "Hot Work"), page("019", "Welding Safety")].join("\n"));
    const { withinImport } = findDuplicateCandidates(talks, []);
    expect(withinImport.find((g) => g.group === "hot-work-welding").members).toHaveLength(2);
  });
});

// Real-file checks — the whole point of the parser.
describe.skipIf(!fs.existsSync(DOCX))("300_Toolbox_Talks_Library.docx", () => {
  let talks;
  beforeAll(() => {
    talks = parseTalks(readDocxText(fs.readFileSync(DOCX)));
  });

  it("parses exactly 300 talks numbered 001..300", () => {
    expect(talks).toHaveLength(300);
    expect(talks[0].number).toBe("001");
    expect(talks[299].number).toBe("300");
  });

  it("gives every talk all nine sections", () => {
    for (const t of talks) {
      expect(t.whyItMatters, t.number).not.toBe("");
      for (const f of ["keyHazards", "requiredControls", "employeesMust", "employeesMustNot", "goodPractice", "emergencyResponse", "supervisorDiscussion"]) {
        expect(t[f].length, `${t.number} ${f}`).toBeGreaterThan(0);
      }
    }
  });

  it("keeps titles that contain ':' or '/'", () => {
    const byNum = Object.fromEntries(talks.map((t) => [t.number, t.title]));
    expect(byNum["001"]).toBe("PPE: Selection, Use and Care");
    expect(byNum["014"]).toBe("Lockout/Tagout");
    expect(byNum["098"]).toBe("Permit to Work: Hot Work");
    expect(byNum["300"]).toBe("Working at Customer Premises: Hygiene");
  });
});
