// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const { supabase } = require("../utility/supabaseClient");
const { getAllowedJobsiteIds, isJobsiteAllowed } = require("./siteScope");

const fromSpy = vi.spyOn(supabase, "from");

const membersQuery = (result) => {
  const query = {
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  ["select", "eq"].forEach((method) => {
    query[method] = vi.fn(() => query);
  });
  return query;
};

describe("siteScope service: getAllowedJobsiteIds", () => {
  const superintendent = {
    id: "user-1",
    companyId: "gc-1",
    companyType: "gc",
    tier: "premium",
    role: "superintendent",
  };

  it.each(["admin", "safety_manager", "foreman"])(
    "returns null without querying for the company-wide %s role",
    async (role) => {
      fromSpy.mockReset();

      await expect(getAllowedJobsiteIds({ ...superintendent, role })).resolves.toBeNull();
      expect(fromSpy).not.toHaveBeenCalled();
    },
  );

  it.each(["basic"])(
    "returns no sites, without querying, once the company is off GC Portfolio (tier %s)",
    async (tier) => {
      fromSpy.mockReset();

      await expect(getAllowedJobsiteIds({ ...superintendent, tier })).resolves.toEqual([]);
      expect(fromSpy).not.toHaveBeenCalled();
    },
  );

  it("returns a superintendent's assigned jobsite ids, scoped to their own company", async () => {
    const query = membersQuery({
      data: [{ jobsite_id: "site-a" }, { jobsite_id: "site-b" }],
      error: null,
    });
    fromSpy.mockReset().mockReturnValue(query);

    await expect(getAllowedJobsiteIds(superintendent)).resolves.toEqual(["site-a", "site-b"]);
    expect(fromSpy).toHaveBeenCalledWith("jobsite_members");
    expect(query.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(query.eq).toHaveBeenCalledWith("jobsites.gc_company_id", "gc-1");
  });

  it("returns an empty array for a superintendent with no assignments", async () => {
    fromSpy.mockReset().mockReturnValue(membersQuery({ data: [], error: null }));

    await expect(getAllowedJobsiteIds(superintendent)).resolves.toEqual([]);
  });

  it("throws a 502 when the lookup fails", async () => {
    fromSpy.mockReset().mockReturnValue(membersQuery({ data: null, error: { code: "X" } }));

    await expect(getAllowedJobsiteIds(superintendent)).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not check your assigned jobsites",
    });
  });
});

describe("siteScope service: isJobsiteAllowed", () => {
  it("admits every jobsite for an unrestricted (null) scope", () => {
    expect(isJobsiteAllowed(null, "site-a")).toBe(true);
  });

  it("admits only assigned jobsites for a scoped user", () => {
    expect(isJobsiteAllowed(["site-a"], "site-a")).toBe(true);
    expect(isJobsiteAllowed(["site-a"], "site-b")).toBe(false);
    expect(isJobsiteAllowed([], "site-a")).toBe(false);
  });
});

describe("siteScope service: assertSiteRolesAvailable", () => {
  const companiesService = require("./companies");
  const { assertSiteRolesAvailable } = require("./siteScope");
  const getCompanySpy = vi.spyOn(companiesService, "getById");

  it.each(["premium", "enterprise"])("passes for a GC Portfolio company (tier %s)", async (tier) => {
    getCompanySpy.mockReset().mockResolvedValue({ id: "gc-1", companyType: "gc", tier });

    await expect(assertSiteRolesAvailable("gc-1")).resolves.toBeUndefined();
  });

  it.each([
    ["gc", "basic"],
    ["subcontractor", "premium"],
  ])("throws a 403 PLAN_LIMIT for a %s company on tier %s", async (companyType, tier) => {
    getCompanySpy.mockReset().mockResolvedValue({ id: "c-1", companyType, tier });

    await expect(assertSiteRolesAvailable("c-1")).rejects.toMatchObject({
      statusCode: 403,
      data: { code: "PLAN_LIMIT" },
    });
  });
});
