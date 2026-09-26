// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const { supabase } = require("../utility/supabaseClient");
const { isSponsored, resolveEffectiveTier } = require("./sponsorship");

const fromSpy = vi.spyOn(supabase, "from");

const countQuery = (result) => {
  const query = {
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  ["select", "eq", "not", "is"].forEach((method) => {
    query[method] = vi.fn(() => query);
  });
  return query;
};

describe("sponsorship service", () => {
  let query;

  const setup = (result) => {
    query = countQuery(result);
    fromSpy.mockReset().mockReturnValue(query);
  };

  describe("isSponsored", () => {
    it("is true when the sub holds an accepted row on a live Site Pro jobsite", async () => {
      setup({ count: 1, error: null });

      await expect(isSponsored("sub-1")).resolves.toBe(true);
      expect(fromSpy).toHaveBeenCalledWith("jobsite_subcontractors");
      expect(query.eq).toHaveBeenCalledWith("sub_company_id", "sub-1");
      expect(query.eq).toHaveBeenCalledWith("jobsites.plan", "site_pro");
      expect(query.eq).toHaveBeenCalledWith("jobsites.status", "active");
      expect(query.is).toHaveBeenCalledWith("jobsites.archived_at", null);
      expect(query.not).toHaveBeenCalledWith("accepted_at", "is", null);
    });

    it("is false when there is no such row", async () => {
      setup({ count: 0, error: null });

      await expect(isSponsored("sub-1")).resolves.toBe(false);
    });

    it("throws a 502 when the lookup fails", async () => {
      setup({ count: null, error: { code: "X" } });

      await expect(isSponsored("sub-1")).rejects.toMatchObject({
        statusCode: 502,
        message: "Could not check your sponsorship",
      });
    });
  });

  describe("resolveEffectiveTier", () => {
    it("lifts a sponsored Free subcontractor to premium", async () => {
      setup({ count: 1, error: null });

      await expect(
        resolveEffectiveTier({ companyId: "sub-1", companyType: "subcontractor", tier: "basic" }),
      ).resolves.toBe("premium");
    });

    it("leaves an unsponsored Free subcontractor on basic", async () => {
      setup({ count: 0, error: null });

      await expect(
        resolveEffectiveTier({ companyId: "sub-1", companyType: "subcontractor", tier: "basic" }),
      ).resolves.toBe("basic");
    });

    it("skips the lookup for paid subcontractors and for GCs", async () => {
      setup({ count: 1, error: null });

      await expect(
        resolveEffectiveTier({ companyId: "c", companyType: "subcontractor", tier: "enterprise" }),
      ).resolves.toBe("enterprise");
      await expect(
        resolveEffectiveTier({ companyId: "c", companyType: "gc", tier: "basic" }),
      ).resolves.toBe("basic");
      expect(fromSpy).not.toHaveBeenCalled();
    });
  });
});
