// Plain CommonJS — no `import` (see vitest.config.js / CLAUDE.md). Vitest
// exposes describe/it/expect as globals.

const { planBackfill, placeholderEmail } = require("./backfillPlan");

let counter;
const newId = () => `id-${++counter}`;
const now = () => "2026-09-24T00:00:00.000Z";

const project = (overrides = {}) => ({
  id: "p1",
  owner_company_id: "sub-1",
  gc_company_id: "gc-1",
  jobsite_id: null,
  name: "Riverside Tower",
  created_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const plan = (input) => planBackfill({ newId, now, ...input });

beforeEach(() => {
  counter = 0;
});

describe("planBackfill", () => {
  it("creates a jobsite, an accepted member row and a project update for one linked project", () => {
    const result = plan({
      projects: [project()],
      adminEmailByCompany: new Map([["sub-1", "admin@sub.com"]]),
    });

    expect(result.jobsitesToInsert).toEqual([
      { id: "id-1", gc_company_id: "gc-1", name: "Riverside Tower" },
    ]);
    expect(result.subRowsToInsert).toEqual([
      {
        id: "id-2",
        jobsite_id: "id-1",
        sub_company_id: "sub-1",
        invited_email: "admin@sub.com",
        token: null,
        expires_at: null,
        accepted_at: "2026-09-24T00:00:00.000Z",
      },
    ]);
    expect(result.projectUpdates).toEqual([{ id: "p1", jobsite_id: "id-1" }]);
  });

  it("puts two subs on one jobsite when a GC's linked names normalize the same", () => {
    const result = plan({
      projects: [
        project({ id: "p1", owner_company_id: "sub-1" }),
        project({
          id: "p2",
          owner_company_id: "sub-2",
          name: "  riverside   TOWER ",
          created_at: "2026-02-01T00:00:00.000Z",
        }),
      ],
      adminEmailByCompany: new Map([
        ["sub-1", "a@sub1.com"],
        ["sub-2", "a@sub2.com"],
      ]),
    });

    expect(result.jobsitesToInsert).toHaveLength(1);
    expect(result.subRowsToInsert.map((r) => r.sub_company_id)).toEqual([
      "sub-1",
      "sub-2",
    ]);
    expect(result.projectUpdates.map((u) => u.jobsite_id)).toEqual([
      "id-1",
      "id-1",
    ]);
  });

  it("names the jobsite after the oldest project's spelling regardless of input order", () => {
    const result = plan({
      projects: [
        project({
          id: "p2",
          name: "riverside tower",
          created_at: "2026-02-01T00:00:00.000Z",
        }),
        project({ id: "p1", name: "Riverside Tower" }),
      ],
    });

    expect(result.jobsitesToInsert[0].name).toBe("Riverside Tower");
  });

  it("keeps two GCs' same-named jobsites separate", () => {
    const result = plan({
      projects: [
        project({ id: "p1", gc_company_id: "gc-1" }),
        project({ id: "p2", gc_company_id: "gc-2", owner_company_id: "sub-2" }),
      ],
    });

    expect(result.jobsitesToInsert.map((j) => j.gc_company_id)).toEqual([
      "gc-1",
      "gc-2",
    ]);
  });

  it("reuses an existing GC jobsite with the same normalized name instead of inserting one", () => {
    const result = plan({
      projects: [project()],
      existingJobsites: [
        { id: "existing-1", gc_company_id: "gc-1", name: "RIVERSIDE  tower" },
      ],
    });

    expect(result.jobsitesToInsert).toEqual([]);
    expect(result.projectUpdates).toEqual([
      { id: "p1", jobsite_id: "existing-1" },
    ]);
    expect(result.subRowsToInsert[0].jobsite_id).toBe("existing-1");
  });

  it("does not reuse another GC's jobsite of the same name", () => {
    const result = plan({
      projects: [project()],
      existingJobsites: [
        { id: "other", gc_company_id: "gc-2", name: "Riverside Tower" },
      ],
    });

    expect(result.jobsitesToInsert).toHaveLength(1);
  });

  it("skips projects that already have a jobsite or no GC link", () => {
    const result = plan({
      projects: [
        project({ id: "p1", jobsite_id: "already" }),
        project({ id: "p2", gc_company_id: null }),
      ],
    });

    expect(result).toEqual({
      jobsitesToInsert: [],
      subRowsToInsert: [],
      projectUpdates: [],
    });
  });

  it("is idempotent: re-planning after applying the result yields nothing", () => {
    const first = plan({
      projects: [project()],
      adminEmailByCompany: new Map([["sub-1", "admin@sub.com"]]),
    });

    const second = plan({
      projects: [project({ jobsite_id: first.projectUpdates[0].jobsite_id })],
      existingJobsites: first.jobsitesToInsert,
      existingSubRows: first.subRowsToInsert,
    });

    expect(second).toEqual({
      jobsitesToInsert: [],
      subRowsToInsert: [],
      projectUpdates: [],
    });
  });

  it("falls back to a deterministic placeholder email when the sub has no admin email", () => {
    const result = plan({
      projects: [project()],
      adminEmailByCompany: new Map([["sub-1", null]]),
    });

    expect(result.subRowsToInsert[0].invited_email).toBe(
      placeholderEmail("sub-1"),
    );
    expect(placeholderEmail("sub-1")).toMatch(/@backfill\.invalid$/);
  });

  it("falls back to the placeholder when the admin email is already taken on that jobsite", () => {
    const result = plan({
      projects: [project()],
      existingJobsites: [
        { id: "existing-1", gc_company_id: "gc-1", name: "Riverside Tower" },
      ],
      existingSubRows: [
        {
          jobsite_id: "existing-1",
          sub_company_id: null,
          invited_email: "admin@sub.com",
        },
      ],
      adminEmailByCompany: new Map([["sub-1", "admin@sub.com"]]),
    });

    expect(result.subRowsToInsert[0].invited_email).toBe(
      placeholderEmail("sub-1"),
    );
  });

  it("writes one member row when a sub has several projects on the same jobsite", () => {
    const result = plan({
      projects: [
        project({ id: "p1" }),
        project({ id: "p2", created_at: "2026-02-01T00:00:00.000Z" }),
      ],
    });

    expect(result.subRowsToInsert).toHaveLength(1);
    expect(result.projectUpdates).toHaveLength(2);
  });

  it("does not duplicate an existing accepted membership", () => {
    const result = plan({
      projects: [project()],
      existingJobsites: [
        { id: "existing-1", gc_company_id: "gc-1", name: "Riverside Tower" },
      ],
      existingSubRows: [
        {
          jobsite_id: "existing-1",
          sub_company_id: "sub-1",
          invited_email: "x@sub.com",
        },
      ],
    });

    expect(result.subRowsToInsert).toEqual([]);
    expect(result.projectUpdates).toHaveLength(1);
  });

  it("generates ids with crypto.randomUUID and a real timestamp by default", () => {
    const result = planBackfill({ projects: [project()] });

    expect(result.jobsitesToInsert[0].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(Number.isNaN(Date.parse(result.subRowsToInsert[0].accepted_at))).toBe(
      false,
    );
  });
});
