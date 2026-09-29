// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const jobsitesService = require("./jobsites");
const { resolveBrandingAccess } = require("./branding");

const hasActiveSiteProSpy = vi.spyOn(jobsitesService, "hasActiveSitePro");

describe("branding service: resolveBrandingAccess", () => {
  beforeEach(() => {
    hasActiveSiteProSpy.mockReset();
  });

  it("is true for a Trade Pro subcontractor without touching jobsites", async () => {
    await expect(
      resolveBrandingAccess({ companyId: "sub-1", companyType: "subcontractor", tier: "premium" }),
    ).resolves.toBe(true);
    expect(hasActiveSiteProSpy).not.toHaveBeenCalled();
  });

  it("is false for a Trade Free subcontractor without touching jobsites", async () => {
    await expect(
      resolveBrandingAccess({ companyId: "sub-1", companyType: "subcontractor", tier: "basic" }),
    ).resolves.toBe(false);
    expect(hasActiveSiteProSpy).not.toHaveBeenCalled();
  });

  it("is true for a GC Portfolio company without touching jobsites", async () => {
    await expect(
      resolveBrandingAccess({ companyId: "gc-1", companyType: "gc", tier: "premium" }),
    ).resolves.toBe(true);
    expect(hasActiveSiteProSpy).not.toHaveBeenCalled();
  });

  it("falls through to hasActiveSitePro for a GC Free company, resolving true when it owns a Site Pro jobsite", async () => {
    hasActiveSiteProSpy.mockResolvedValue(true);

    await expect(
      resolveBrandingAccess({ companyId: "gc-1", companyType: "gc", tier: "basic" }),
    ).resolves.toBe(true);
    expect(hasActiveSiteProSpy).toHaveBeenCalledWith("gc-1");
  });

  it("is false for a GC Free company with no Site Pro jobsite", async () => {
    hasActiveSiteProSpy.mockResolvedValue(false);

    await expect(
      resolveBrandingAccess({ companyId: "gc-1", companyType: "gc", tier: "basic" }),
    ).resolves.toBe(false);
    expect(hasActiveSiteProSpy).toHaveBeenCalledWith("gc-1");
  });

  it("propagates a hasActiveSitePro failure", async () => {
    const error = { statusCode: 502, message: "Could not check your job site plan" };
    hasActiveSiteProSpy.mockRejectedValue(error);

    await expect(
      resolveBrandingAccess({ companyId: "gc-1", companyType: "gc", tier: "basic" }),
    ).rejects.toBe(error);
  });
});
