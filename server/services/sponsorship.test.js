// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const { supabase } = require("../utility/supabaseClient");
const { isSponsored, resolveEffectiveTier } = require("./sponsorship");

const fromSpy = vi.spyOn(supabase, "from");

const rowsQuery = (result) => {
  const query = {
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  ["select", "eq", "not", "is"].forEach((method) => {
    query[method] = vi.fn(() => query);
  });
  return query;
};

const row = (plan, tier = "basic") => ({ jobsites: { plan, companies: { tier } } });

describe("sponsorship service", () => {
  let query;

  const setup = (data, error = null) => {
    query = rowsQuery({ data, error });
    fromSpy.mockReset().mockReturnValue(query);
  };

  describe("isSponsored", () => {
    it("is true when the sub holds an accepted row on a live Site Pro jobsite", async () => {
      setup([row("site_pro")]);

      await expect(isSponsored("sub-1")).resolves.toBe(true);
      expect(fromSpy).toHaveBeenCalledWith("jobsite_subcontractors");
      expect(query.eq).toHaveBeenCalledWith("sub_company_id", "sub-1");
      expect(query.eq).toHaveBeenCalledWith("jobsites.status", "active");
      expect(query.is).toHaveBeenCalledWith("jobsites.archived_at", null);
      expect(query.not).toHaveBeenCalledWith("accepted_at", "is", null);
    });

    it("is true on a free-plan jobsite whose GC is on Portfolio", async () => {
      setup([row("free", "premium")]);
      await expect(isSponsored("sub-1")).resolves.toBe(true);

      setup([row("free", "enterprise")]);
      await expect(isSponsored("sub-1")).resolves.toBe(true);
    });

    it("is false when no live site has Site Pro access", async () => {
      setup([row("free", "basic")]);
      await expect(isSponsored("sub-1")).resolves.toBe(false);

      setup([]);
      await expect(isSponsored("sub-1")).resolves.toBe(false);
    });

    it("tolerates a jobsite row with no company embed", async () => {
      setup([{ jobsites: { plan: "free" } }]);
      await expect(isSponsored("sub-1")).resolves.toBe(false);
    });

    it("throws a 502 when the lookup fails", async () => {
      setup(null, { code: "X" });

      await expect(isSponsored("sub-1")).rejects.toMatchObject({
        statusCode: 502,
        message: "Could not check your sponsorship",
      });
    });
  });

  describe("resolveEffectiveTier", () => {
    it("lifts a sponsored Free subcontractor to premium", async () => {
      setup([row("site_pro")]);

      await expect(
        resolveEffectiveTier({ companyId: "sub-1", companyType: "subcontractor", tier: "basic" }),
      ).resolves.toBe("premium");
    });

    it("leaves an unsponsored Free subcontractor on basic", async () => {
      setup([]);

      await expect(
        resolveEffectiveTier({ companyId: "sub-1", companyType: "subcontractor", tier: "basic" }),
      ).resolves.toBe("basic");
    });

    it("gives an in-house crew its parent's plan mapped onto the sub ladder", async () => {
      setup([]);
      const crew = { companyId: "crew-1", companyType: "subcontractor", tier: "basic" };

      await expect(resolveEffectiveTier({ ...crew, parentTier: "premium" })).resolves.toBe("premium");
      await expect(resolveEffectiveTier({ ...crew, parentTier: "enterprise" })).resolves.toBe(
        "premium",
      );
      expect(fromSpy).not.toHaveBeenCalled();
    });

    it("keeps a Free GC's crew on basic unless it is on a sponsored site", async () => {
      const crew = {
        companyId: "crew-1",
        companyType: "subcontractor",
        tier: "basic",
        parentTier: "basic",
      };

      setup([]);
      await expect(resolveEffectiveTier(crew)).resolves.toBe("basic");

      setup([row("site_pro")]);
      await expect(resolveEffectiveTier(crew)).resolves.toBe("premium");
    });

    it("skips the lookup for paid subcontractors and for GCs", async () => {
      setup([row("site_pro")]);

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
