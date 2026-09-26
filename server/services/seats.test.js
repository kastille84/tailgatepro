// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const { supabase } = require("../utility/supabaseClient");
const companiesService = require("./companies");
const { assertSeatAvailable } = require("./seats");

const fromSpy = vi.spyOn(supabase, "from");
const getCompanySpy = vi.spyOn(companiesService, "getById");

// Records every filter applied to a thenable count query so tests can assert
// which role/expiry/email filters were used.
const countQuery = (result) => {
  const calls = [];
  const query = {
    calls,
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  ["eq", "gt", "neq"].forEach((method) => {
    query[method] = vi.fn((...args) => {
      calls.push([method, ...args]);
      return query;
    });
  });
  query.select = vi.fn(() => query);
  return query;
};

const base = { companyId: "company-1", role: "foreman", email: "new@example.com" };

describe("seats service: assertSeatAvailable", () => {
  let usersQuery;
  let invitesQuery;

  const setup = ({ companyType = "subcontractor", tier, users = 0, invites = 0 }) => {
    getCompanySpy.mockReset().mockResolvedValue({ id: "company-1", companyType, tier });
    usersQuery = countQuery({ count: users, error: null });
    invitesQuery = countQuery({ count: invites, error: null });
    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "users") return usersQuery;
      if (table === "company_invites") return invitesQuery;
      throw new Error(`Unexpected table: ${table}`);
    });
  };

  it("skips all counting for a plan with unlimited seats", async () => {
    setup({ tier: "enterprise" });

    await expect(assertSeatAvailable({ ...base, includePending: true })).resolves.toBeUndefined();
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("skips counting for a GC company", async () => {
    setup({ companyType: "gc", tier: "basic" });

    await assertSeatAvailable({ ...base, includePending: true });
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("Free: blocks any invite once the owner fills the one seat, whatever the role", async () => {
    setup({ tier: "basic", users: 1 });

    await expect(
      assertSeatAvailable({ ...base, role: "safety_manager", includePending: true }),
    ).rejects.toMatchObject({
      statusCode: 403,
      data: { code: "PLAN_LIMIT", limit: 1 },
    });
    // Free counts every role, so no role filter is applied.
    expect(usersQuery.calls.some(([method, column]) => method === "eq" && column === "role")).toBe(false);
  });

  it("Free: counts pending invites too, ignoring the same email's own invite", async () => {
    setup({ tier: "basic", users: 0, invites: 1 });

    await expect(assertSeatAvailable({ ...base, includePending: true })).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(invitesQuery.calls).toContainEqual(["neq", "email", "new@example.com"]);
    expect(invitesQuery.calls.some(([method, column]) => method === "gt" && column === "expires_at")).toBe(true);
  });

  it("Pro: allows a foreman invite when below 8 foremen and only counts the foreman role", async () => {
    setup({ tier: "premium", users: 6, invites: 1 });

    await expect(assertSeatAvailable({ ...base, includePending: true })).resolves.toBeUndefined();
    expect(usersQuery.calls).toContainEqual(["eq", "role", "foreman"]);
    expect(invitesQuery.calls).toContainEqual(["eq", "role", "foreman"]);
  });

  it("Pro: blocks the 9th foreman", async () => {
    setup({ tier: "premium", users: 7, invites: 1 });

    await expect(assertSeatAvailable({ ...base, includePending: true })).rejects.toMatchObject({
      statusCode: 403,
      data: { code: "PLAN_LIMIT", limit: 8 },
    });
  });

  it("Pro: never limits admin or safety manager invites", async () => {
    setup({ tier: "premium", users: 8 });

    await assertSeatAvailable({ ...base, role: "admin", includePending: true });
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("at accept time (includePending false) only counts active users", async () => {
    setup({ tier: "premium", users: 7, invites: 5 });

    await expect(assertSeatAvailable({ ...base, includePending: false })).resolves.toBeUndefined();
    expect(fromSpy).not.toHaveBeenCalledWith("company_invites");
  });

  it("treats a null count as zero", async () => {
    setup({ tier: "basic" });
    usersQuery = countQuery({ count: null, error: null });

    await expect(assertSeatAvailable({ ...base, includePending: false })).resolves.toBeUndefined();
  });

  it("throws a 502 when the users count fails", async () => {
    setup({ tier: "basic" });
    usersQuery = countQuery({ count: null, error: { code: "X" } });

    await expect(assertSeatAvailable({ ...base, includePending: false })).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not check your plan's seats",
    });
  });

  it("throws a 502 when the pending-invites count fails", async () => {
    setup({ tier: "premium", users: 0 });
    invitesQuery = countQuery({ count: null, error: { code: "X" } });

    await expect(assertSeatAvailable({ ...base, includePending: true })).rejects.toMatchObject({
      statusCode: 502,
    });
  });
});
