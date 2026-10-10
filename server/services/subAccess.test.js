// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const { supabase } = require("../utility/supabaseClient");
const companiesService = require("./companies");
const { getUnlockedSubIds, listAcceptedGcIds } = require("./subAccess");

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

const row = (subId, acceptedAt, plan = "free", parentGcId = null) => ({
  sub_company_id: subId,
  accepted_at: acceptedAt,
  companies: { parent_gc_company_id: parentGcId },
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

  it("always unlocks the GC's own in-house crews without using the free slot", async () => {
    setup({
      result: {
        data: [
          row("free", "2026-01-01T00:00:00Z"),
          row("crew", "2026-02-01T00:00:00Z", "free", "gc-1"),
          row("other-gcs-crew", "2026-03-01T00:00:00Z", "free", "gc-2"),
        ],
        error: null,
      },
    });

    const unlocked = await getUnlockedSubIds("gc-1");

    expect([...unlocked].sort()).toEqual(["crew", "free"]);
  });

  it("tolerates a roster row with no company embed", async () => {
    setup({
      result: {
        data: [{ sub_company_id: "a", accepted_at: "2026-01-01T00:00:00Z", jobsites: { plan: "free" } }],
        error: null,
      },
    });

    await expect(getUnlockedSubIds("gc-1")).resolves.toEqual(new Set(["a"]));
  });

  it("throws a 502 when the roster lookup fails", async () => {
    setup({ result: { data: null, error: { code: "X" } } });

    await expect(getUnlockedSubIds("gc-1")).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not check your plan's subcontractors",
    });
  });
});

describe("subAccess service: listAcceptedGcIds", () => {
  const membershipQuery = (result) => {
    const query = {
      then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };
    ["select", "eq", "not", "is"].forEach((method) => {
      query[method] = vi.fn(() => query);
    });
    return query;
  };

  it("returns the distinct GC ids and scopes to the sub's accepted, non-archived memberships", async () => {
    const query = membershipQuery({
      data: [
        { jobsites: { gc_company_id: "gc-1" } },
        { jobsites: { gc_company_id: "gc-2" } },
        { jobsites: { gc_company_id: "gc-1" } },
      ],
      error: null,
    });
    fromSpy.mockReset().mockReturnValue(query);

    await expect(listAcceptedGcIds("sub-1")).resolves.toEqual(["gc-1", "gc-2"]);
    expect(fromSpy).toHaveBeenCalledWith("jobsite_subcontractors");
    expect(query.eq).toHaveBeenCalledWith("sub_company_id", "sub-1");
    expect(query.not).toHaveBeenCalledWith("accepted_at", "is", null);
    expect(query.is).toHaveBeenCalledWith("jobsites.archived_at", null);
  });

  it("returns an empty list when the sub has no accepted memberships", async () => {
    fromSpy.mockReset().mockReturnValue(membershipQuery({ data: [], error: null }));

    await expect(listAcceptedGcIds("sub-1")).resolves.toEqual([]);
  });

  it("throws a 502 when the membership lookup fails", async () => {
    fromSpy
      .mockReset()
      .mockReturnValue(membershipQuery({ data: null, error: { code: "X" } }));

    await expect(listAcceptedGcIds("sub-1")).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not check your jobsite memberships",
    });
  });
});
