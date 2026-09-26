// Plain CommonJS — no `import` (see vitest.config.js / CLAUDE.md). Vitest
// exposes describe/it/expect as globals.

const fs = require("fs");
const path = require("path");

const { toUsEnglish, findUkTerms } = require("./usEnglish");
const { parseRawTalk, buildTalkingPoints, titleMissingFromBody, buildTalkJson, isAllowedSource, mergeLedgers } = require("./tbtBuild");
const { toRawMarkdown } = require("./parseToolboxDocx");
const catalog = require("./tbtCatalog");
const { buildRow } = require("./talkRow");

const talk = (over = {}) => ({
  number: "008",
  title: "Reach Truck Safety",
  category: "Health, Safety & Environmental Briefing",
  duration: "5–10 minutes",
  whyItMatters: "Reach Truck Safety matters because collisions cause injuries.",
  keyHazards: ["Collision with pedestrians", "poor visibility"],
  requiredControls: ["Keep pedestrians and vehicles segregated", "carry out pre-use checks", "use a banksman where visibility is restricted", "observe site speed limits"],
  employeesMust: ["Hold a valid licence before operating", "give way to pedestrians"],
  employeesMustNot: ["Operate equipment you are not trained for", "use a mobile phone while operating", "carry passengers"],
  goodPractice: ["Sound the horn at blind corners"],
  emergencyResponse: ["Stop the vehicle safely", "call the emergency services", "report the incident", "extra ignored"],
  supervisorDiscussion: ["What are the main hazards of Reach Truck Safety on our jobs?"],
  ...over,
});

describe("toUsEnglish", () => {
  it.each([
    ["Use a banksman/slinger", "Use a signal person/rigger"],
    ["Check the COSHH assessment/SDS", "Check the hazard assessment/SDS"],
    ["Read the RAMS before starting", "Read the JHA before starting"],
    ["Hold the F-Gas qualification", "Hold the EPA Section 608 certification"],
    ["follow the RIDDOR process", "follow the OSHA recordkeeping and reporting process"],
    ["call the emergency services", "call 911"],
    ["call the fire service", "call the fire department"],
    ["over 1.2m", "over 5 feet"],
    ["Hold a valid licence", "Hold a valid license"],
    ["unauthorised access to the pressurised line", "unauthorized access to the pressurized line"],
    ["re-energisation and depressurisation", "re-energization and depressurization"],
    ["minimise the naked flame near the torch", "minimize the open flames near the flashlight"],
    ["Lock-off devices and lock off the isolator", "Lockout devices and lock out the isolator"],
    ["Permit to Work: Hot Work", "Hot Work"],
  ])("%s -> %s", (input, expected) => {
    expect(toUsEnglish(input)).toBe(expected);
  });

  it("leaves US English alone", () => {
    expect(toUsEnglish("Raise the alarm and evacuate")).toBe("Raise the alarm and evacuate");
  });
});

describe("findUkTerms", () => {
  it("finds leftovers and is empty for clean text", () => {
    expect(findUkTerms("Report under RIDDOR to the HSE")).toEqual(expect.arrayContaining(["RIDDOR", "HSE"]));
    expect(findUkTerms("Wear your respirator.")).toEqual([]);
  });
});

describe("parseRawTalk", () => {
  it("round-trips a raw file written by toRawMarkdown", () => {
    const md = toRawMarkdown(talk(), { sourcePath: "data/x.docx", scrapedDate: "2026-01-01T00:00:00Z", hash: "abc123" });
    const parsed = parseRawTalk(md);
    expect(parsed).toMatchObject({ number: "008", title: "Reach Truck Safety", bodyHash: "abc123" });
    expect(parsed.requiredControls).toHaveLength(4);
    expect(parsed.supervisorDiscussion).toEqual(["What are the main hazards of Reach Truck Safety on our jobs?"]);
  });

  it("rejects files without frontmatter or a TBT number", () => {
    expect(() => parseRawTalk("# no frontmatter")).toThrow(/frontmatter/);
    expect(() => parseRawTalk('---\ntitle: "x"\n---\n')).toThrow(/tbt_number/);
  });
});

describe("buildTalkingPoints", () => {
  it("builds at most 8 sentences and folds emergency into one final point", () => {
    const pts = buildTalkingPoints(talk());
    expect(pts.length).toBeLessThanOrEqual(8);
    expect(pts.every((p) => /[.!?]$/.test(p))).toBe(true);
    expect(pts).toContain("Never operate equipment you are not trained for.");
    expect(pts.at(-1)).toMatch(/^If something goes wrong: stop the vehicle safely; call the emergency services; report the incident\.$/);
    expect(pts.at(-1)).not.toMatch(/extra ignored/);
  });

  it("keeps acronyms capitalized when turning 'must not' into 'Never'", () => {
    const pts = buildTalkingPoints(talk({ employeesMustNot: ["PPE must not be shared"] }));
    expect(pts).toContain("Never PPE must not be shared.");
  });

  it("drops a point that repeats an earlier one", () => {
    const pts = buildTalkingPoints(
      talk({ requiredControls: ["Inspect the ladder before every use"], employeesMust: ["Inspect the ladder before every use"], employeesMustNot: [], goodPractice: [], emergencyResponse: [] })
    );
    expect(pts).toEqual(["Inspect the ladder before every use."]);
  });
});

describe("titleMissingFromBody", () => {
  it("is true when no title word appears in the body, false otherwise", () => {
    expect(titleMissingFromBody("Working on Condensers", talk({ keyHazards: ["cold room entrapment"] }))).toBe(true);
    expect(titleMissingFromBody("Reach Truck Safety", talk({ keyHazards: ["reach truck tip-over"] }))).toBe(false);
  });
});

describe("buildTalkJson", () => {
  const meta = { title: "Reach Truck Safety", primary: "Heavy Equipment", tags: ["General Construction", "Heavy Equipment"], osha: ["29 CFR 1926.602"] };
  const now = "2026-09-25T00:00:00Z";

  it("produces the standard schema with owner-provided attribution", () => {
    const json = buildTalkJson(talk({ keyHazards: ["reach truck tip-over"], requiredControls: ["reach truck checks"] }), meta, { siblings: [], now, verified: true });
    expect(json).toMatchObject({
      id: "reach-truck-safety",
      primary_trade: "Heavy Equipment",
      trade_tags: ["Heavy Equipment", "General Construction"],
      estimated_minutes: 5,
      attribution: { source: "TailgatePro Library", license: "owner-provided-unverified", source_url: null, source_ref: "TBT-008" },
    });
    expect(json.summary).toBe("Reach Truck Safety matters because collisions cause injuries.");
    expect(json.audit).toMatchObject({ status: "approved", osha_accuracy_verified: true, audited_at: now });
    expect(JSON.stringify(json.attribution)).not.toMatch(/CPWR|NIOSH/);
  });

  it("localizes wording and never leaves UK terms", () => {
    const json = buildTalkJson(talk(), meta, { siblings: [], now });
    expect(json.talking_points.join(" ")).toMatch(/signal person/);
    expect(json.talking_points.join(" ")).not.toMatch(/banksman|emergency services/);
  });

  it("marks talks that share a body as needs_revision and never verified", () => {
    const json = buildTalkJson(talk({ keyHazards: ["reach truck"] }), meta, { siblings: ["007", "009"], now, verified: true });
    expect(json.audit.status).toBe("needs_revision");
    expect(json.audit.osha_accuracy_verified).toBe(false);
    expect(json.audit.flags[0]).toMatch(/^generic-body:.*TBT-007, TBT-009/);
  });

  it("flags a title/body mismatch", () => {
    const json = buildTalkJson(talk(), { ...meta, title: "Working on Condensers" }, { siblings: [], now });
    expect(json.audit.status).toBe("needs_revision");
    expect(json.audit.flags.some((f) => f.startsWith("title-body-mismatch"))).toBe(true);
  });

  it("is accepted by the seed loader's row builder", () => {
    const json = buildTalkJson(talk({ keyHazards: ["reach truck"] }), meta, { siblings: [], now });
    const row = buildRow(json);
    expect(row).toMatchObject({ slug: "reach-truck-safety", trade_tag: "Heavy Equipment", is_global: true });
    expect(row.content).toContain("# Reach Truck Safety");
  });
});

describe("tbtCatalog", () => {
  const nums = Array.from({ length: 300 }, (_, i) => String(i + 1).padStart(3, "0"));

  it("classifies every TBT number exactly once", () => {
    const buckets = [catalog.DUPLICATES, catalog.WITHIN_IMPORT_DUPLICATES, catalog.OUT_OF_SCOPE, catalog.ROWS];
    for (const n of nums) {
      const hits = buckets.filter((b) => n in b).length;
      expect(hits, `TBT-${n}`).toBe(1);
    }
    expect(buckets.reduce((sum, b) => sum + Object.keys(b).length, 0)).toBe(300);
  });

  it("uses known trades and non-empty OSHA lists", () => {
    for (const [n, [primary, tags, osha]] of Object.entries(catalog.ROWS)) {
      expect(catalog.TRADE_SLUGS[primary], `TBT-${n} primary`).toBeDefined();
      tags.forEach((t) => expect(catalog.TRADE_SLUGS[t], `TBT-${n} tag ${t}`).toBeDefined());
      expect(osha.length, `TBT-${n} osha`).toBeGreaterThan(0);
      osha.forEach((s) => expect(s, `TBT-${n}`).toMatch(/^(29 CFR \d{4}\.\d+|OSH Act Section 5\(a\)\(1\) General Duty Clause)$/));
    }
  });
});

// Generated output, when present (data/processed/** is committed).
describe.skipIf(!fs.existsSync(path.join(__dirname, "..", "..", "data", "processed", "general-construction")))("generated talks", () => {
  const root = path.join(__dirname, "..", "..", "data", "processed");
  const files = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) => fs.readdirSync(path.join(root, d.name)).map((f) => path.join(root, d.name, f)))
    .map((f) => JSON.parse(fs.readFileSync(f, "utf8")))
    .filter((j) => j.attribution?.source === "TailgatePro Library");

  it("has no UK terms, unique ids, and only approved talks that are verified", () => {
    const ids = new Set();
    for (const j of files) {
      expect(findUkTerms(JSON.stringify({ ...j, audit: undefined })), j.id).toEqual([]);
      expect(ids.has(j.id), `duplicate id ${j.id}`).toBe(false);
      ids.add(j.id);
      if (j.audit.status === "approved") expect(j.audit.osha_accuracy_verified, j.id).toBe(true);
    }
  });
});

describe("isAllowedSource", () => {
  it.each([
    ["https://www.osha.gov/sites/default/files/publications/x.pdf", true],
    ["https://www.cpwr.com/wp-content/uploads/TT-Nail_Guns.pdf", true],
    ["https://www.cdc.gov/niosh/construction/hazards.html", true],
    ["https://www.epa.gov/section608", true],
    ["https://www.dir.ca.gov/dosh/x.html", true],
    ["https://www.osha.gov.evil.com/x", false],
    ["https://www.cdc.gov/flu/index.html", false],
    ["https://www.safetytalkscommercial.com/ladder", false],
    ["not a url", false],
    ["ftp://osha.gov/x", false],
  ])("%s -> %s", (url, ok) => {
    expect(isAllowedSource(url)).toBe(ok);
  });

  it("allows state .gov OSHA-plan hosts", () => {
    expect(isAllowedSource("https://www.calosha.state.ca.gov/x")).toBe(true);
  });
});

describe("mergeLedgers", () => {
  const url = "https://www.osha.gov/a";

  it("keeps matched rows, first TBT wins a shared source, later ones become no-source", () => {
    const merged = mergeLedgers([{ "010": { status: "matched", source_url: url } }, { "011": { status: "matched", source_url: url } }]);
    expect(merged["010"].status).toBe("matched");
    expect(merged["011"]).toMatchObject({ status: "no-source", note: "source already claimed by TBT-010" });
  });

  it("also treats the same raw file under a different URL as one source", () => {
    const merged = mergeLedgers([
      { "011": { status: "matched", source_url: "https://www.osha.gov/a", raw_file: "x.md" }, "256": { status: "matched", source_url: "https://www.osha.gov/b", raw_file: "x.md" } },
    ]);
    expect(merged["256"]).toMatchObject({ status: "no-source", note: "source already claimed by TBT-011" });
  });

  it("downgrades a non-allowed domain and a source used by an existing talk", () => {
    const merged = mergeLedgers(
      [{ "012": { status: "matched", source_url: "https://blog.example.com/x" }, "013": { status: "matched", source_url: url } }],
      new Set([url])
    );
    expect(merged["012"].status).toBe("no-source");
    expect(merged["013"].status).toBe("duplicate-of-existing");
  });

  it("passes through no-source / duplicate rows and rejects a TBT in two ledgers", () => {
    expect(mergeLedgers([{ "014": { status: "no-source", note: "x" } }])["014"].status).toBe("no-source");
    expect(() => mergeLedgers([{ "014": { status: "no-source" } }, { "014": { status: "no-source" } }])).toThrow(/more than one ledger/);
  });
});
