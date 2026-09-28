// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const { supabase } = require("../utility/supabaseClient");
const siteScopeService = require("./siteScope");
const gcDashboardService = require("./gcDashboard");
const { listSubcontractorScorecards, getSubcontractorScorecard } = require("./scorecards");

const fromSpy = vi.spyOn(supabase, "from");
const assertScorecardsSpy = vi.spyOn(siteScopeService, "assertScorecardsAvailable");
const listLinkedProjectsSpy = vi.spyOn(gcDashboardService, "listLinkedProjects");
const listCompletedLogsInWindowSpy = vi.spyOn(gcDashboardService, "listCompletedLogsInWindow");
const getCompanyNamesByIdsSpy = vi.spyOn(gcDashboardService, "getCompanyNamesByIds");

// A self-returning query chain that resolves to `result` when awaited, so the
// mock doesn't depend on the exact order of .eq/.is/.not/.in calls (mirrors
// gcDashboard.test.js's own `chain` helper).
const chain = (result) => {
  const builder = {};
  ["select", "eq", "is", "not", "in"].forEach((method) => {
    builder[method] = vi.fn(() => builder);
  });
  builder.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return builder;
};

const rosterRow = (overrides) => ({
  jobsite_id: "jobsite-1",
  sub_company_id: "sub-1",
  accepted_at: "2026-08-01T00:00:00.000Z",
  jobsites: { name: "Riverside Tower", gc_company_id: "gc-1", status: "active", archived_at: null },
  ...overrides,
});

const project = (overrides) => ({
  id: "project-1",
  ownerCompanyId: "sub-1",
  jobsiteId: "jobsite-1",
  name: "Riverside Tower",
  status: "active",
  archivedAt: null,
  createdAt: "2026-08-01T00:00:00.000Z",
  ...overrides,
});

const args = { date: "2026-09-21", tzOffset: 0 };

describe("scorecards service", () => {
  beforeEach(() => {
    assertScorecardsSpy.mockReset().mockResolvedValue(undefined);
    listLinkedProjectsSpy.mockReset().mockResolvedValue([project()]);
    listCompletedLogsInWindowSpy.mockReset().mockResolvedValue([]);
    getCompanyNamesByIdsSpy.mockReset().mockResolvedValue(new Map([["sub-1", "Acme Roofing"]]));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "jobsite_subcontractors") return chain({ data: [rosterRow()], error: null });
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  describe("listSubcontractorScorecards", () => {
    it("should throw a 403 PLAN_LIMIT for a non-Portfolio GC, without querying anything", async () => {
      // Arrange
      const planError = Object.assign(new Error("Upgrade to use this"), {
        statusCode: 403,
        data: { code: "PLAN_LIMIT" },
      });
      assertScorecardsSpy.mockRejectedValue(planError);

      // Act & Assert
      await expect(listSubcontractorScorecards("gc-1", args)).rejects.toBe(planError);
      expect(fromSpy).not.toHaveBeenCalled();
    });

    it("should return an empty list when the portfolio has no accepted subs", async () => {
      // Arrange
      fromSpy.mockImplementation(() => chain({ data: [], error: null }));

      // Act
      const result = await listSubcontractorScorecards("gc-1", args);

      // Assert
      expect(result).toEqual([]);
    });

    it("should return one summary per sub, with a 30-day compliance score and no jobsite breakdown", async () => {
      // Arrange
      listCompletedLogsInWindowSpy.mockResolvedValue([
        { project_id: "project-1", held_at: "2026-09-21T12:00:00.000Z" },
      ]);

      // Act
      const result = await listSubcontractorScorecards("gc-1", args);

      // Assert
      expect(result).toEqual([
        { companyId: "sub-1", companyName: "Acme Roofing", overallScore: expect.any(Number) },
      ]);
      expect(result[0]).not.toHaveProperty("jobsites");
    });

    it("should sort worst-first by overall score", async () => {
      // Arrange — sub-1 logs every day (high score), sub-2 never logs (0%).
      fromSpy.mockImplementation((table) => {
        if (table === "jobsite_subcontractors") {
          return chain({
            data: [
              rosterRow({ accepted_at: "2020-01-01T00:00:00.000Z" }),
              rosterRow({ sub_company_id: "sub-2", accepted_at: "2020-01-01T00:00:00.000Z" }),
            ],
            error: null,
          });
        }
        throw new Error(`Unexpected table: ${table}`);
      });
      getCompanyNamesByIdsSpy.mockResolvedValue(
        new Map([
          ["sub-1", "Acme Roofing"],
          ["sub-2", "Zenith Electric"],
        ]),
      );
      listCompletedLogsInWindowSpy.mockResolvedValue([
        { project_id: "project-1", held_at: "2026-09-21T12:00:00.000Z" },
      ]);

      // Act
      const result = await listSubcontractorScorecards("gc-1", args);

      // Assert — sub-2 (0%) sorts before sub-1 (>0%).
      expect(result.map((s) => s.companyId)).toEqual(["sub-2", "sub-1"]);
    });

    it("should narrow the roster to a site-scoped user's assigned jobsites", async () => {
      // Act
      await listSubcontractorScorecards("gc-1", { ...args, allowedJobsiteIds: ["jobsite-1"] });

      // Assert
      expect(fromSpy.mock.results[0].value.in).toHaveBeenCalledWith("jobsite_id", ["jobsite-1"]);
      expect(listLinkedProjectsSpy).toHaveBeenCalledWith("gc-1", ["jobsite-1"]);
    });

    it("should return an empty list without querying the roster when a site-scoped user has no assigned jobsites", async () => {
      // Act
      const result = await listSubcontractorScorecards("gc-1", { ...args, allowedJobsiteIds: [] });

      // Assert
      expect(result).toEqual([]);
      expect(fromSpy).not.toHaveBeenCalled();
    });

    it("should throw a 502 when the roster query fails", async () => {
      // Arrange
      fromSpy.mockImplementation(() => chain({ data: null, error: new Error("db down") }));

      // Act & Assert
      await expect(listSubcontractorScorecards("gc-1", args)).rejects.toMatchObject({
        statusCode: 502,
        message: "Could not load your portfolio roster",
      });
    });
  });

  describe("getSubcontractorScorecard", () => {
    it("should return one sub's score plus its per-jobsite breakdown", async () => {
      // Act
      const result = await getSubcontractorScorecard("sub-1", "gc-1", args);

      // Assert
      expect(result).toEqual({
        companyId: "sub-1",
        companyName: "Acme Roofing",
        overallScore: expect.any(Number),
        jobsites: [
          {
            jobsiteId: "jobsite-1",
            jobsiteName: "Riverside Tower",
            expectedDays: expect.any(Number),
            loggedDays: expect.any(Number),
            score: expect.any(Number),
          },
        ],
      });
    });

    it("should roll up more than one jobsite for the same sub", async () => {
      // Arrange
      fromSpy.mockImplementation((table) => {
        if (table === "jobsite_subcontractors") {
          return chain({
            data: [
              rosterRow(),
              rosterRow({ jobsite_id: "jobsite-2", jobsites: { ...rosterRow().jobsites, name: "North Site" } }),
            ],
            error: null,
          });
        }
        throw new Error(`Unexpected table: ${table}`);
      });
      listLinkedProjectsSpy.mockResolvedValue([
        project(),
        project({ id: "project-2", jobsiteId: "jobsite-2" }),
      ]);

      // Act
      const result = await getSubcontractorScorecard("sub-1", "gc-1", args);

      // Assert
      expect(result.jobsites.map((j) => j.jobsiteId)).toEqual(["jobsite-1", "jobsite-2"]);
    });

    it("should 404 for a companyId that isn't a current accepted roster member anywhere in scope", async () => {
      // Act & Assert
      await expect(getSubcontractorScorecard("someone-else", "gc-1", args)).rejects.toMatchObject({
        statusCode: 404,
        message: "Subcontractor not found",
      });
    });

    it("should 404 when the portfolio has no accepted subs at all", async () => {
      // Arrange
      fromSpy.mockImplementation(() => chain({ data: [], error: null }));

      // Act & Assert
      await expect(getSubcontractorScorecard("sub-1", "gc-1", args)).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("should propagate the 403 PLAN_LIMIT for a non-Portfolio GC", async () => {
      // Arrange
      const planError = Object.assign(new Error("Upgrade to use this"), {
        statusCode: 403,
        data: { code: "PLAN_LIMIT" },
      });
      assertScorecardsSpy.mockRejectedValue(planError);

      // Act & Assert
      await expect(getSubcontractorScorecard("sub-1", "gc-1", args)).rejects.toBe(planError);
    });
  });
});
