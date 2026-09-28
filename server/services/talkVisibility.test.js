// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const subAccessService = require("./subAccess");
const { resolveTalkVisibility } = require("./talkVisibility");

const listAcceptedGcIdsSpy = vi.spyOn(subAccessService, "listAcceptedGcIds");

describe("talkVisibility service: resolveTalkVisibility", () => {
  beforeEach(() => {
    listAcceptedGcIdsSpy.mockReset().mockResolvedValue(["gc-1", "gc-2"]);
  });

  it("gives a paid subcontractor the full library plus the GCs it works for", async () => {
    await expect(
      resolveTalkVisibility({ companyId: "sub-1", companyType: "subcontractor", tier: "premium" }),
    ).resolves.toEqual({ fullLibrary: true, gcCompanyIds: ["gc-1", "gc-2"] });
    expect(listAcceptedGcIdsSpy).toHaveBeenCalledWith("sub-1");
  });

  it("keeps a Trade Free subcontractor core-only but still admits its GCs' talks", async () => {
    await expect(
      resolveTalkVisibility({ companyId: "sub-1", companyType: "subcontractor", tier: "basic" }),
    ).resolves.toEqual({ fullLibrary: false, gcCompanyIds: ["gc-1", "gc-2"] });
  });

  it("gives a GC no extra company ids and skips the membership lookup", async () => {
    await expect(
      resolveTalkVisibility({ companyId: "gc-9", companyType: "gc", tier: "premium" }),
    ).resolves.toEqual({ fullLibrary: true, gcCompanyIds: [] });
    expect(listAcceptedGcIdsSpy).not.toHaveBeenCalled();
  });
});
