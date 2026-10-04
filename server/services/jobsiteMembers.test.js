// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const { supabase } = require("../utility/supabaseClient");
const jobsitesService = require("./jobsites");
const siteScopeService = require("./siteScope");
const { listForJobsite, setMembers } = require("./jobsiteMembers");

const fromSpy = vi.spyOn(supabase, "from");
const ownedSpy = vi.spyOn(jobsitesService, "getOwnedJobsite");
const assertSpy = vi.spyOn(siteScopeService, "assertSiteRolesAvailable");

// A self-returning chain that resolves to `result` when awaited.
const chain = (result) => {
  const builder = { then: (resolve, reject) => Promise.resolve(result).then(resolve, reject) };
  ["select", "eq", "in", "order", "delete", "insert"].forEach((method) => {
    builder[method] = vi.fn(() => builder);
  });
  return builder;
};

const args = { jobsiteId: "site-1", gcCompanyId: "gc-1" };
const supers = [
  { id: "u-1", name: "Ann" },
  { id: "u-2", name: "Bob" },
];

describe("jobsiteMembers service", () => {
  let users;
  let members;
  let memberCalls;

  // members results are consumed in call order: first the "current" read, then any writes.
  const setup = ({ usersResult = { data: supers, error: null }, memberResults }) => {
    users = chain(usersResult);
    memberCalls = memberResults.map(chain);
    members = [...memberCalls];
    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "users") return users;
      if (table === "jobsite_members") return members.shift();
      throw new Error(`Unexpected table: ${table}`);
    });
  };

  beforeEach(() => {
    ownedSpy.mockReset().mockResolvedValue({ id: "site-1" });
    assertSpy.mockReset().mockResolvedValue(undefined);
  });

  describe("listForJobsite", () => {
    it("lists the company's superintendents flagged by assignment", async () => {
      setup({ memberResults: [{ data: [{ user_id: "u-2" }], error: null }] });

      const result = await listForJobsite(args);

      expect(ownedSpy).toHaveBeenCalledWith("site-1", "gc-1");
      expect(users.eq).toHaveBeenCalledWith("company_id", "gc-1");
      expect(users.eq).toHaveBeenCalledWith("role", "superintendent");
      expect(result).toEqual({
        members: [
          { userId: "u-1", name: "Ann", assigned: false },
          { userId: "u-2", name: "Bob", assigned: true },
        ],
      });
    });

    it("propagates the 404 for a jobsite the caller doesn't own, querying nothing else", async () => {
      ownedSpy.mockRejectedValue(Object.assign(new Error("Jobsite not found"), { statusCode: 404 }));
      fromSpy.mockReset();

      await expect(listForJobsite(args)).rejects.toMatchObject({ statusCode: 404 });
      expect(fromSpy).not.toHaveBeenCalled();
    });

    it("throws a 502 when the superintendent lookup fails", async () => {
      setup({
        usersResult: { data: null, error: { code: "X" } },
        memberResults: [{ data: [], error: null }],
      });

      await expect(listForJobsite(args)).rejects.toMatchObject({
        statusCode: 502,
        message: "Could not load superintendents",
      });
    });

    it("throws a 502 when the member lookup fails", async () => {
      setup({ memberResults: [{ data: null, error: { code: "X" } }] });

      await expect(listForJobsite(args)).rejects.toMatchObject({
        statusCode: 502,
        message: "Could not load the jobsite's members",
      });
    });
  });

  describe("setMembers", () => {
    it("adds and removes only the difference, then returns the fresh list", async () => {
      // current = [u-2]; wanted = [u-1] -> remove u-2, add u-1.
      setup({
        memberResults: [
          { data: [{ user_id: "u-2" }], error: null }, // current read
          { data: null, error: null }, // delete
          { data: null, error: null }, // insert
          { data: [{ user_id: "u-1" }], error: null }, // re-read for the response
        ],
      });

      const result = await setMembers({ ...args, userIds: ["u-1", "u-1"] });

      expect(assertSpy).toHaveBeenCalledWith("gc-1");
      expect(memberCalls[1].delete).toHaveBeenCalled();
      expect(memberCalls[1].eq).toHaveBeenCalledWith("jobsite_id", "site-1");
      expect(memberCalls[1].in).toHaveBeenCalledWith("user_id", ["u-2"]);
      expect(memberCalls[2].insert).toHaveBeenCalledWith([{ jobsite_id: "site-1", user_id: "u-1" }]);
      expect(result.members.find((m) => m.userId === "u-1").assigned).toBe(true);
    });

    it("writes nothing when the set is unchanged", async () => {
      setup({
        memberResults: [
          { data: [{ user_id: "u-1" }], error: null },
          { data: [{ user_id: "u-1" }], error: null },
        ],
      });

      await setMembers({ ...args, userIds: ["u-1"] });

      expect(memberCalls[0].delete).not.toHaveBeenCalled();
      expect(memberCalls[0].insert).not.toHaveBeenCalled();
    });

    it("throws a 400 and writes nothing for an id that isn't one of the company's superintendents", async () => {
      setup({ memberResults: [{ data: [], error: null }] });

      await expect(setMembers({ ...args, userIds: ["someone-else"] })).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(memberCalls[0].insert).not.toHaveBeenCalled();
    });

    it("propagates the Portfolio gate's PLAN_LIMIT before touching the database", async () => {
      assertSpy.mockRejectedValue(
        Object.assign(new Error("upgrade"), { statusCode: 403, data: { code: "PLAN_LIMIT" } }),
      );
      fromSpy.mockReset();

      await expect(setMembers({ ...args, userIds: [] })).rejects.toMatchObject({
        statusCode: 403,
        data: { code: "PLAN_LIMIT" },
      });
      expect(ownedSpy).not.toHaveBeenCalled();
      expect(fromSpy).not.toHaveBeenCalled();
    });

    it("throws a 502 when the delete fails", async () => {
      setup({
        memberResults: [
          { data: [{ user_id: "u-2" }], error: null },
          { data: null, error: { code: "X" } },
        ],
      });

      await expect(setMembers({ ...args, userIds: [] })).rejects.toMatchObject({
        statusCode: 502,
        message: "Could not update the jobsite's members",
      });
    });

    it("throws a 502 when the insert fails", async () => {
      setup({
        memberResults: [
          { data: [], error: null },
          { data: null, error: { code: "X" } },
        ],
      });

      await expect(setMembers({ ...args, userIds: ["u-1"] })).rejects.toMatchObject({
        statusCode: 502,
        message: "Could not update the jobsite's members",
      });
    });
  });
});
