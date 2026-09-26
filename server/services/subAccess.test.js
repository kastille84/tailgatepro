// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const { supabase } = require("../utility/supabaseClient");
const companiesService = require("./companies");
const { getUnlockedSubIds } = require("./subAccess");

const fromSpy = vi.spyOn(supabase, "from");
const getCompanySpy = vi.spyOn(companiesService, "getById");

const rosterQuery = (result) => {
  const query = {
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  ["select", "eq", "not"].forEach((method) => {
    query[method] = vi.fn(() => query);
  });
  return query;
};

const row = (subId, acceptedAt, plan = "free") => ({
  sub_company_id: subId,
  accepted_at: acceptedAt,
  jobsites: { gc_company_id: "gc-1", plan },
});

describe("subAccess service: getUnlockedSubIds", () => {
  let query;

  const setup = ({ tier = "basic", result }) => {
    getCompanySpy.mockReset().mockResolvedValue({ id: "gc-1", companyType: "gc", tier });
    query = rosterQuery(result);
    fromSpy.mockReset().mockReturnValue(query);
  };

  it("returns null without querying for a GC plan with no cap", async () => {
    setup({ tier: "premium", result: { data: [], error: null } });

    await expect(getUnlockedSubIds("gc-1")).resolves.toBeNull();
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("unlocks the earliest-accepted sub for GC Free and scopes to the GC's own jobsites", async () => {
    setup({
      result: {
        data: [row("late", "2026-03-01T00:00:00Z"), row("early", "2026-01-01T00:00:00Z")],
        error: null,
      },
    });

    const unlocked = await getUnlockedSubIds("gc-1");

    expect([...unlocked]).toEqual(["early"]);
    expect(query.eq).toHaveBeenCalledWith("jobsites.gc_company_id", "gc-1");
    expect(query.not).toHaveBeenCalledWith("accepted_at", "is", null);
  });

  it("also unlocks subs on a Site Pro jobsite", async () => {
    setup({
      result: {
        data: [row("free", "2026-01-01T00:00:00Z"), row("paid", "2026-02-01T00:00:00Z", "site_pro")],
        error: null,
      },
    });

    const unlocked = await getUnlockedSubIds("gc-1");

    expect([...unlocked].sort()).toEqual(["free", "paid"]);
  });

  it("throws a 502 when the roster lookup fails", async () => {
    setup({ result: { data: null, error: { code: "X" } } });

    await expect(getUnlockedSubIds("gc-1")).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not check your plan's subcontractors",
    });
  });
});
