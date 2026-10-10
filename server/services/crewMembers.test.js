// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const { supabase } = require("../utility/supabaseClient");
const companiesService = require("./companies");
const { listMembers, removeMember } = require("./crewMembers");

const fromSpy = vi.spyOn(supabase, "from");
const getUserByIdSpy = vi.spyOn(supabase.auth.admin, "getUserById");
const deleteUserSpy = vi.spyOn(supabase.auth.admin, "deleteUser");
const getOwnedCrewSpy = vi.spyOn(companiesService, "getOwnedCrew");

const chain = (result) => {
  const q = {};
  ["select", "eq", "order", "delete"].forEach((m) => {
    q[m] = vi.fn(() => q);
  });
  q.maybeSingle = vi.fn().mockResolvedValue(result);
  q.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return q;
};

beforeEach(() => {
  fromSpy.mockReset();
  getUserByIdSpy.mockReset();
  deleteUserSpy.mockReset().mockResolvedValue({ error: null });
  getOwnedCrewSpy.mockReset().mockResolvedValue({ id: "crew-1", name: "Crew", archivedAt: null });
});

describe("crewMembers service: listMembers", () => {
  it("lists the crew's people with their auth emails", async () => {
    const q = chain({
      data: [
        { id: "u1", name: "Jamie", role: "foreman" },
        { id: "u2", name: "Sam", role: "admin" },
      ],
      error: null,
    });
    fromSpy.mockReturnValue(q);
    getUserByIdSpy.mockImplementation(async (id) => ({
      data: { user: id === "u1" ? { email: "jamie@example.com" } : null },
      error: null,
    }));

    const result = await listMembers("crew-1", "gc-1");

    expect(getOwnedCrewSpy).toHaveBeenCalledWith("crew-1", "gc-1");
    expect(q.eq).toHaveBeenCalledWith("company_id", "crew-1");
    expect(result).toEqual([
      { id: "u1", name: "Jamie", role: "foreman", email: "jamie@example.com" },
      { id: "u2", name: "Sam", role: "admin", email: null },
    ]);
  });

  it("404s for a crew the GC does not own, without reading users", async () => {
    getOwnedCrewSpy.mockRejectedValue(Object.assign(new Error("Crew not found"), { statusCode: 404 }));

    await expect(listMembers("crew-1", "gc-1")).rejects.toMatchObject({ statusCode: 404 });
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("throws a 502 when the users read fails", async () => {
    fromSpy.mockReturnValue(chain({ data: null, error: { code: "X" } }));

    await expect(listMembers("crew-1", "gc-1")).rejects.toMatchObject({ statusCode: 502 });
  });

  it("throws a 502 when an email lookup fails", async () => {
    fromSpy.mockReturnValue(chain({ data: [{ id: "u1", name: "Jamie", role: "foreman" }], error: null }));
    getUserByIdSpy.mockResolvedValue({ data: null, error: { message: "nope" } });

    await expect(listMembers("crew-1", "gc-1")).rejects.toMatchObject({ statusCode: 502 });
  });
});

describe("crewMembers service: removeMember", () => {
  it("deletes the user row scoped to the crew, then the auth account", async () => {
    const lookup = chain({ data: { id: "u1" }, error: null });
    const del = chain({ error: null });
    fromSpy.mockReturnValueOnce(lookup).mockReturnValueOnce(del);

    await removeMember("crew-1", "u1", "gc-1");

    expect(getOwnedCrewSpy).toHaveBeenCalledWith("crew-1", "gc-1");
    expect(lookup.eq).toHaveBeenCalledWith("company_id", "crew-1");
    expect(del.delete).toHaveBeenCalled();
    expect(del.eq).toHaveBeenCalledWith("id", "u1");
    expect(del.eq).toHaveBeenCalledWith("company_id", "crew-1");
    expect(deleteUserSpy).toHaveBeenCalledWith("u1");
  });

  it("404s for a user who is not in this crew, deleting nothing", async () => {
    fromSpy.mockReturnValue(chain({ data: null, error: null }));

    await expect(removeMember("crew-1", "other-user", "gc-1")).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(deleteUserSpy).not.toHaveBeenCalled();
  });

  it("404s for a crew the GC does not own", async () => {
    getOwnedCrewSpy.mockRejectedValue(Object.assign(new Error("Crew not found"), { statusCode: 404 }));

    await expect(removeMember("crew-1", "u1", "gc-1")).rejects.toMatchObject({ statusCode: 404 });
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("throws a 502 when the lookup fails", async () => {
    fromSpy.mockReturnValue(chain({ data: null, error: { code: "X" } }));

    await expect(removeMember("crew-1", "u1", "gc-1")).rejects.toMatchObject({ statusCode: 502 });
  });

  it("throws a 502 and keeps the auth account when the row delete fails", async () => {
    fromSpy
      .mockReturnValueOnce(chain({ data: { id: "u1" }, error: null }))
      .mockReturnValueOnce(chain({ error: { code: "X" } }));

    await expect(removeMember("crew-1", "u1", "gc-1")).rejects.toMatchObject({ statusCode: 502 });
    expect(deleteUserSpy).not.toHaveBeenCalled();
  });

  it("logs and still succeeds when the auth account cannot be deleted", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fromSpy
      .mockReturnValueOnce(chain({ data: { id: "u1" }, error: null }))
      .mockReturnValueOnce(chain({ error: null }));
    deleteUserSpy.mockResolvedValue({ error: { message: "auth down" } });

    await expect(removeMember("crew-1", "u1", "gc-1")).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
