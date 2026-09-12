// Plain CommonJS — no `import` (see vitest.config.js / CLAUDE.md). Vitest
// exposes describe/it/expect as globals. Canonical test for
// composeTalkMarkdown — scripts/lib/talkRow.js re-exports this function
// under the name `composeMarkdown` but doesn't re-test it (see
// talkRow.test.js), so this is the one place its behavior is asserted.

const { composeTalkMarkdown } = require("./composeTalkMarkdown");

const baseJson = {
  id: "electrical-arc-flash-safety",
  title: "Arc Flash Safety",
  primary_trade: "Electrical",
  trade_tags: ["Electrical", "General Construction"],
  osha_standards: ["29 CFR 1926.416", "29 CFR 1910.333"],
  estimated_minutes: 5,
  summary: "Arc flash can cause severe burns; de-energize and keep clear.",
  talking_points: ["De-energize before work", "Wear arc-rated PPE"],
  site_hazards_to_check: ["Exposed energized parts", "Missing lockout devices"],
  discussion_questions: ["What PPE is required for this panel?"],
  attribution: {
    source: "NIOSH",
    publisher: "National Institute for Occupational Safety and Health (NIOSH)",
    copyright: "U.S. Government work — public domain.",
    license: "public-domain",
    source_url: "https://www.cdc.gov/niosh/docs/2022-136/2022-136.pdf",
    notice:
      "Adapted from a NIOSH Toolbox Talk (co-developed with CPWR). " +
      "Public-domain source; not an endorsement by NIOSH or CPWR.",
  },
};

describe("composeTalkMarkdown", () => {
  it("includes every populated section and the OSHA/minutes footer", () => {
    const md = composeTalkMarkdown(baseJson);
    expect(md).toContain("# Arc Flash Safety");
    expect(md).toContain("**Summary:** Arc flash can cause severe burns");
    expect(md).toContain("## Talking points");
    expect(md).toContain("- De-energize before work");
    expect(md).toContain("## Hazards to check on site");
    expect(md).toContain("- Exposed energized parts");
    expect(md).toContain("## Discussion questions");
    expect(md).toContain("- What PPE is required for this panel?");
    expect(md).toContain("_OSHA: 29 CFR 1926.416 · 29 CFR 1910.333 · ~5 min_");
    expect(md.endsWith("\n")).toBe(true);
  });

  it("appends a source-credit footer when attribution is present", () => {
    const md = composeTalkMarkdown(baseJson);
    expect(md).toContain("---");
    expect(md).toContain("_Source: U.S. Government work — public domain.");
    expect(md).toContain("not an endorsement by NIOSH or CPWR._");
  });

  it("has no source-credit footer when attribution is absent", () => {
    const md = composeTalkMarkdown({ id: "x", title: "No Credit", estimated_minutes: 5 });
    expect(md).not.toContain("_Source:");
  });

  it("omits sections whose source array is empty or missing", () => {
    const md = composeTalkMarkdown({
      id: "x",
      title: "Bare Talk",
      talking_points: [],
      site_hazards_to_check: [],
      discussion_questions: [],
      osha_standards: [],
    });
    expect(md).toContain("# Bare Talk");
    expect(md).not.toContain("## Talking points");
    expect(md).not.toContain("## Hazards to check on site");
    expect(md).not.toContain("## Discussion questions");
    expect(md).not.toContain("OSHA:");
    expect(md).not.toContain("Summary:");
  });

  it("emits a minutes-only footer when there are no OSHA standards", () => {
    const md = composeTalkMarkdown({ id: "x", title: "T", estimated_minutes: 10 });
    expect(md).toContain("_~10 min_");
  });
});
