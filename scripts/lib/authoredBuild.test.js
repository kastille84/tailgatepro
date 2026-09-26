// Plain CommonJS (see vitest.config.js); Vitest exposes describe/it/expect as globals.
const { validateAuthored, buildAuthoredJson } = require("./authoredBuild");

const good = () => ({
  n: "276",
  title: "Working Near Conveyors",
  primary_trade: "General Construction",
  trade_tags: ["General Construction", "Heavy Equipment"],
  osha_standards: ["29 CFR 1926.555"],
  summary: "Conveyors can start without warning.",
  talking_points: ["a", "b", "c", "d", "e", "f"],
  site_hazards_to_check: ["1", "2", "3", "4"],
  discussion_questions: ["q1", "q2", "q3"],
  source_agency: "OSHA",
  source_url: "https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.555",
  source_checked: ["https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.555"],
  basis: "29 CFR 1926.555 (Conveyors)",
});

describe("validateAuthored", () => {
  it("accepts a well-formed talk", () => {
    expect(validateAuthored(good())).toEqual([]);
  });

  it("rejects a source outside the allowed domains", () => {
    const a = { ...good(), source_url: "https://example.com/toolbox-talk" };
    expect(validateAuthored(a).join(" ")).toMatch(/allowed domain/);
  });

  it("rejects an unchecked source list, unknown trades and thin content", () => {
    const a = { ...good(), source_checked: [], primary_trade: "Nope", talking_points: ["only one"] };
    const p = validateAuthored(a).join(" ");
    expect(p).toMatch(/source_checked/);
    expect(p).toMatch(/not a known trade/);
    expect(p).toMatch(/talking_points/);
  });

  it("allows \"torch\" as a U.S. welding term", () => {
    const a = { ...good(), summary: "Light the brazing torch with a friction lighter." };
    expect(validateAuthored(a)).toEqual([]);
  });

  it("rejects leftover UK wording", () => {
    const a = { ...good(), summary: "Wear your PPE and follow the HSE guidance." };
    expect(validateAuthored(a).join(" ")).toMatch(/UK/);
  });

  it("does not let an approved talk skip accuracy verification", () => {
    const a = { ...good(), audit: { status: "approved", audited_at: "x", osha_accuracy_verified: false, flags: [] } };
    expect(validateAuthored(a).join(" ")).toMatch(/osha_accuracy_verified/);
  });
});

describe("buildAuthoredJson", () => {
  const now = "2026-09-26T00:00:00Z";

  it("builds the schema with original-work attribution and a pending audit", () => {
    const j = buildAuthoredJson(good(), { now });
    expect(j.id).toBe("working-near-conveyors");
    expect(j.attribution).toMatchObject({ source: "TailgatePro", license: "original-work", source_ref: "TBT-276" });
    expect(j.attribution.notice).toMatch(/Not an endorsement by OSHA\.$/);
    expect(j.audit).toMatchObject({ status: "needs_revision", osha_accuracy_verified: false });
    expect(Object.keys(j)).toEqual([
      "id", "title", "primary_trade", "trade_tags", "osha_standards", "estimated_minutes",
      "summary", "talking_points", "site_hazards_to_check", "discussion_questions", "attribution", "audit",
    ]);
  });

  it("passes through an auditor's approval", () => {
    const audit = { status: "approved", audited_at: now, osha_accuracy_verified: true, flags: ["ok"] };
    expect(buildAuthoredJson({ ...good(), audit }, { now }).audit).toEqual(audit);
  });

  it("throws with the TBT number when the talk is invalid", () => {
    expect(() => buildAuthoredJson({ ...good(), summary: "" }, { now })).toThrow(/TBT-276/);
  });
});
