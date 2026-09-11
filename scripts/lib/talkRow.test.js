// Plain CommonJS — no `import` (see vitest.config.js / CLAUDE.md). Vitest
// exposes describe/it/expect as globals.

const { buildRow, composeMarkdown, isApproved } = require("./talkRow");

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
  audit: {
    status: "approved",
    audited_at: "2026-01-01T00:00:00Z",
    osha_accuracy_verified: true,
    flags: [],
  },
};

describe("isApproved", () => {
  it("is true only when audit.status is 'approved'", () => {
    expect(isApproved(baseJson)).toBe(true);
    expect(isApproved({ ...baseJson, audit: { status: "needs_revision" } })).toBe(false);
    expect(isApproved({ ...baseJson, audit: undefined })).toBe(false);
    expect(isApproved({})).toBe(false);
    expect(isApproved(null)).toBe(false);
  });
});

describe("buildRow", () => {
  it("maps pipeline fields onto toolbox_talks columns", () => {
    const row = buildRow(baseJson);
    expect(row.slug).toBe("electrical-arc-flash-safety");
    expect(row.title).toBe("Arc Flash Safety");
    expect(row.trade_tag).toBe("Electrical");
    expect(row.trade_tags).toEqual(["Electrical", "General Construction"]);
    expect(row.is_global).toBe(true);
    expect(row.company_id).toBeNull();
    expect(row.structured).toEqual({
      summary: baseJson.summary,
      talking_points: baseJson.talking_points,
      site_hazards_to_check: baseJson.site_hazards_to_check,
      discussion_questions: baseJson.discussion_questions,
      osha_standards: baseJson.osha_standards,
      estimated_minutes: 5,
    });
    expect(row.content).toContain("Arc Flash Safety");
    expect(row.attribution).toEqual(baseJson.attribution);
  });

  it("passes attribution straight through, defaulting to null when absent", () => {
    expect(buildRow({ id: "x", title: "X", audit: { status: "approved" } }).attribution).toBeNull();
    expect(buildRow(baseJson).attribution).toEqual(baseJson.attribution);
  });

  it("derives a deterministic v5 UUID from the slug", () => {
    const a = buildRow(baseJson).id;
    const b = buildRow({ ...baseJson, title: "Different title" }).id;
    expect(a).toBe(b); // same slug -> same id, regardless of other fields
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(buildRow({ ...baseJson, id: "roofing-ladder-safety" }).id).not.toBe(a);
  });

  it("defaults missing optional collections to [] / null", () => {
    const row = buildRow({ id: "x", title: "X", audit: { status: "approved" } });
    expect(row.trade_tag).toBeNull();
    expect(row.trade_tags).toEqual([]);
    expect(row.structured.talking_points).toEqual([]);
    expect(row.structured.osha_standards).toEqual([]);
    expect(row.structured.summary).toBeNull();
    expect(row.structured.estimated_minutes).toBeNull();
  });

  it("coerces a non-array trade_tags to []", () => {
    expect(buildRow({ ...baseJson, trade_tags: "Electrical" }).trade_tags).toEqual([]);
  });

  it("throws when the slug (id) or title is missing or blank", () => {
    expect(() => buildRow({ title: "No id" })).toThrow(/id/);
    expect(() => buildRow({ id: "  ", title: "Blank id" })).toThrow(/id/);
    expect(() => buildRow({ id: "no-title" })).toThrow(/title/);
    expect(() => buildRow({ id: "blank-title", title: "   " })).toThrow(/title/);
  });
});

describe("composeMarkdown", () => {
  it("includes every populated section and the OSHA/minutes footer", () => {
    const md = composeMarkdown(baseJson);
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
    const md = composeMarkdown(baseJson);
    expect(md).toContain("---");
    expect(md).toContain("_Source: U.S. Government work — public domain.");
    expect(md).toContain("not an endorsement by NIOSH or CPWR._");
  });

  it("has no source-credit footer when attribution is absent", () => {
    const md = composeMarkdown({ id: "x", title: "No Credit", estimated_minutes: 5 });
    expect(md).not.toContain("_Source:");
  });

  it("omits sections whose source array is empty or missing", () => {
    const md = composeMarkdown({
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
    const md = composeMarkdown({ id: "x", title: "T", estimated_minutes: 10 });
    expect(md).toContain("_~10 min_");
  });
});
