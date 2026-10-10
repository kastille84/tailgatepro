// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const { supabase } = require("../utility/supabaseClient");
const companiesService = require("./companies");
const {
  CREW_JOIN_MAX_USES,
  getForCrew,
  createForCrew,
  removeForCrew,
  getActiveByToken,
  previewByToken,
  claimSlot,
  releaseSlot,
} = require("./crewJoinLinks");

const TOKEN = "a".repeat(64);
const FUTURE = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
const PAST = new Date(Date.now() - 1000).toISOString();

const fromSpy = vi.spyOn(supabase, "from");
const getOwnedCrewSpy = vi.spyOn(companiesService, "getOwnedCrew");

// A thenable query chain: every builder method returns the chain, and awaiting it
// (or calling .single()/.maybeSingle()) resolves to `result`.
const chain = (result) => {
  const q = {};
  ["select", "eq", "update", "upsert", "delete"].forEach((m) => {
    q[m] = vi.fn(() => q);
  });
  q.single = vi.fn().mockResolvedValue(result);
  q.maybeSingle = vi.fn().mockResolvedValue(result);
  q.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return q;
};

const row = (overrides = {}) => ({
  token: TOKEN,
  expires_at: FUTURE,
  max_uses: 10,
  uses: 3,
  ...overrides,
});

beforeEach(() => {
  fromSpy.mockReset();
  getOwnedCrewSpy.mockReset().mockResolvedValue({ id: "crew-1", name: "Crew", archivedAt: null });
});

describe("crewJoinLinks service: getForCrew", () => {
  it("checks the crew belongs to the GC before reading", async () => {
    getOwnedCrewSpy.mockRejectedValue(Object.assign(new Error("Crew not found"), { statusCode: 404 }));

    await expect(getForCrew("crew-1", "gc-1")).rejects.toMatchObject({ statusCode: 404 });
    expect(getOwnedCrewSpy).toHaveBeenCalledWith("crew-1", "gc-1");
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("returns the link with the spots left", async () => {
    const q = chain({ data: row(), error: null });
    fromSpy.mockReturnValue(q);

    const result = await getForCrew("crew-1", "gc-1");

    expect(fromSpy).toHaveBeenCalledWith("crew_join_links");
    expect(q.eq).toHaveBeenCalledWith("company_id", "crew-1");
    expect(result).toEqual({ token: TOKEN, expiresAt: FUTURE, usesLeft: 7 });
  });

  it("returns null when the crew has no link", async () => {
    fromSpy.mockReturnValue(chain({ data: null, error: null }));

    expect(await getForCrew("crew-1", "gc-1")).toBeNull();
  });

  it("returns null for an expired or full link", async () => {
    fromSpy.mockReturnValueOnce(chain({ data: row({ expires_at: PAST }), error: null }));
    expect(await getForCrew("crew-1", "gc-1")).toBeNull();

    fromSpy.mockReturnValueOnce(chain({ data: row({ uses: 10 }), error: null }));
    expect(await getForCrew("crew-1", "gc-1")).toBeNull();
  });

  it("throws a 502 when the read fails", async () => {
    fromSpy.mockReturnValue(chain({ data: null, error: { code: "X" } }));

    await expect(getForCrew("crew-1", "gc-1")).rejects.toMatchObject({ statusCode: 502 });
  });
});

describe("crewJoinLinks service: createForCrew", () => {
  it("rejects an archived crew with a 409 and writes nothing", async () => {
    getOwnedCrewSpy.mockResolvedValue({ id: "crew-1", name: "Crew", archivedAt: "2026-01-01" });

    await expect(createForCrew("crew-1", "gc-1")).rejects.toMatchObject({ statusCode: 409 });
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("upserts one link per crew with a fresh token, a 7-day expiry and no uses", async () => {
    const q = chain({ data: row({ uses: 0 }), error: null });
    fromSpy.mockReturnValue(q);

    const result = await createForCrew("crew-1", "gc-1");

    const [written, options] = q.upsert.mock.calls[0];
    expect(options).toEqual({ onConflict: "company_id" });
    expect(written).toMatchObject({ company_id: "crew-1", max_uses: CREW_JOIN_MAX_USES, uses: 0 });
    expect(written.token).toMatch(/^[0-9a-f]{64}$/);
    expect(new Date(written.expires_at).getTime()).toBeGreaterThan(Date.now() + 6 * 86400000);
    expect(result).toEqual({ token: TOKEN, expiresAt: FUTURE, usesLeft: 10 });
  });

  it("throws a 502 when the write fails", async () => {
    fromSpy.mockReturnValue(chain({ data: null, error: { code: "X" } }));

    await expect(createForCrew("crew-1", "gc-1")).rejects.toMatchObject({ statusCode: 502 });
  });
});

describe("crewJoinLinks service: removeForCrew", () => {
  it("deletes the crew's link after the ownership check", async () => {
    const q = chain({ error: null });
    fromSpy.mockReturnValue(q);

    await removeForCrew("crew-1", "gc-1");

    expect(getOwnedCrewSpy).toHaveBeenCalledWith("crew-1", "gc-1");
    expect(q.delete).toHaveBeenCalled();
    expect(q.eq).toHaveBeenCalledWith("company_id", "crew-1");
  });

  it("throws a 502 when the delete fails", async () => {
    fromSpy.mockReturnValue(chain({ error: { code: "X" } }));

    await expect(removeForCrew("crew-1", "gc-1")).rejects.toMatchObject({ statusCode: 502 });
  });
});

describe("crewJoinLinks service: getActiveByToken / previewByToken", () => {
  const linkRow = (overrides = {}) => ({
    id: "link-1",
    company_id: "crew-1",
    expires_at: FUTURE,
    max_uses: 10,
    uses: 2,
    companies: {
      name: "Hyperion - Framing",
      archived_at: null,
      parent_gc_company_id: "gc-1",
      parent: { name: "Hyperion" },
    },
    ...overrides,
  });

  it("resolves a usable link with the crew and GC names", async () => {
    const q = chain({ data: linkRow(), error: null });
    fromSpy.mockReturnValue(q);

    const result = await getActiveByToken(TOKEN);

    expect(q.eq).toHaveBeenCalledWith("token", TOKEN);
    expect(result).toEqual({
      id: "link-1",
      companyId: "crew-1",
      uses: 2,
      crewName: "Hyperion - Framing",
      gcName: "Hyperion",
    });
  });

  it("falls back to a null GC name when the parent embed is missing", async () => {
    const data = linkRow();
    data.companies.parent = null;
    fromSpy.mockReturnValue(chain({ data, error: null }));

    expect((await getActiveByToken(TOKEN)).gcName).toBeNull();
  });

  it.each([
    ["an unknown token", { data: null, error: { code: "PGRST116" } }],
    ["an expired link", { data: linkRow({ expires_at: PAST }), error: null }],
    ["a full link", { data: linkRow({ uses: 10 }), error: null }],
    [
      "an archived crew",
      {
        data: linkRow({
          companies: { name: "C", archived_at: "2026-01-01", parent_gc_company_id: "gc-1" },
        }),
        error: null,
      },
    ],
    [
      "a company that is no longer a crew",
      {
        data: linkRow({
          companies: { name: "C", archived_at: null, parent_gc_company_id: null },
        }),
        error: null,
      },
    ],
    ["a missing company embed", { data: linkRow({ companies: null }), error: null }],
  ])("returns the same 404 for %s", async (_label, result) => {
    fromSpy.mockReturnValue(chain(result));

    await expect(getActiveByToken(TOKEN)).rejects.toMatchObject({
      statusCode: 404,
      message: "This join link is invalid or has expired",
    });
  });

  it("throws a 502 on any other lookup failure", async () => {
    fromSpy.mockReturnValue(chain({ data: null, error: { code: "X" } }));

    await expect(getActiveByToken(TOKEN)).rejects.toMatchObject({ statusCode: 502 });
  });

  it("previews only the crew and GC names, never the token", async () => {
    fromSpy.mockReturnValue(chain({ data: linkRow(), error: null }));

    expect(await previewByToken(TOKEN)).toEqual({
      crewName: "Hyperion - Framing",
      gcName: "Hyperion",
    });
  });
});

describe("crewJoinLinks service: claimSlot / releaseSlot", () => {
  const link = { id: "link-1", uses: 2 };

  it("takes a spot with a compare-and-set on the uses it read", async () => {
    const q = chain({ data: [{ id: "link-1" }], error: null });
    fromSpy.mockReturnValue(q);

    await claimSlot(link);

    expect(q.update).toHaveBeenCalledWith({ uses: 3 });
    expect(q.eq).toHaveBeenCalledWith("id", "link-1");
    expect(q.eq).toHaveBeenCalledWith("uses", 2);
  });

  it("throws a 409 when another signup took the spot first", async () => {
    fromSpy.mockReturnValue(chain({ data: [], error: null }));

    await expect(claimSlot(link)).rejects.toMatchObject({ statusCode: 409 });
  });

  it("throws a 502 when the update fails", async () => {
    fromSpy.mockReturnValue(chain({ data: null, error: { code: "X" } }));

    await expect(claimSlot(link)).rejects.toMatchObject({ statusCode: 502 });
  });

  it("hands a spot back, guarded on the value it set", async () => {
    const q = chain({ error: null });
    fromSpy.mockReturnValue(q);

    await releaseSlot(link);

    expect(q.update).toHaveBeenCalledWith({ uses: 2 });
    expect(q.eq).toHaveBeenCalledWith("uses", 3);
  });

  it("logs and carries on when handing a spot back fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fromSpy.mockReturnValue(chain({ error: { code: "X" } }));

    await expect(releaseSlot(link)).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
