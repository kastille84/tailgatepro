const { parseArgs, selectMeetings } = require("./regeneratePlan");

describe("regeneratePlan: parseArgs", () => {
  it("should default to a dry run with no filters", () => {
    expect(parseArgs([])).toEqual({ apply: false, id: null, company: null, since: null, limit: null });
  });

  it("should parse every flag", () => {
    expect(
      parseArgs(["--apply", "--id", "m1", "--company", "c1", "--since", "2026-09-01", "--limit", "5"]),
    ).toEqual({ apply: true, id: "m1", company: "c1", since: "2026-09-01", limit: 5 });
  });

  it.each([
    [["--bogus"]],
    [["--id"]],
    [["--id", "--apply"]],
    [["--since", "not-a-date"]],
    [["--limit", "0"]],
    [["--limit", "abc"]],
  ])("should throw for %j", (argv) => {
    expect(() => parseArgs(argv)).toThrow(/Usage/);
  });
});

describe("regeneratePlan: selectMeetings", () => {
  const rows = [
    { id: "b", company_id: "c1", completed_at: "2026-09-10T00:00:00Z", final_pdf_url: "b/report.pdf" },
    { id: "a", company_id: "c1", completed_at: "2026-09-01T00:00:00Z", final_pdf_url: "a/report.pdf" },
    { id: "c", company_id: "c2", completed_at: "2026-09-05T00:00:00Z", final_pdf_url: "c/report.pdf" },
    { id: "pending", company_id: "c1", completed_at: "2026-09-02T00:00:00Z", final_pdf_url: null },
    { id: "open", company_id: "c1", completed_at: null, final_pdf_url: null },
  ];
  const none = { id: null, company: null, since: null, limit: null };

  it("should skip meetings without a PDF or completion and sort oldest first", () => {
    expect(selectMeetings(rows, none).map((r) => r.id)).toEqual(["a", "c", "b"]);
  });

  it("should filter by id, company and since", () => {
    expect(selectMeetings(rows, { ...none, id: "c" }).map((r) => r.id)).toEqual(["c"]);
    expect(selectMeetings(rows, { ...none, company: "c1" }).map((r) => r.id)).toEqual(["a", "b"]);
    expect(selectMeetings(rows, { ...none, since: "2026-09-05" }).map((r) => r.id)).toEqual(["c", "b"]);
  });

  it("should cap the result at limit", () => {
    expect(selectMeetings(rows, { ...none, limit: 2 }).map((r) => r.id)).toEqual(["a", "c"]);
  });
});
