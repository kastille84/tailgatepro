const { STRIPE_PLANS, getPriceId, resolvePrice } = require("./stripePlans");
const { PLAN_LIMITS } = require("./entitlements");

const config = {
  price_trade_pro_monthly: "price_tp_m",
  price_trade_pro_annual: "price_tp_a",
  price_trade_enterprise_monthly: "price_te_m",
  price_trade_enterprise_annual: "price_te_a",
  price_gc_portfolio_10_sites_monthly: "price_g10_m",
  price_gc_portfolio_10_sites_annual: "price_g10_a",
  price_gc_portfolio_unlimited_sites_monthly: "price_gu_m",
  price_gc_portfolio_unlimited_sites_annual: "price_gu_a",
};

describe("STRIPE_PLANS", () => {
  it("only maps to companyType:tier pairs that entitlements.js defines", () => {
    for (const plan of Object.values(STRIPE_PLANS)) {
      expect(PLAN_LIMITS[`${plan.companyType}:${plan.tier}`]).toBeDefined();
    }
  });
});

describe("getPriceId", () => {
  it("returns the configured price id for a plan and interval", () => {
    expect(getPriceId("trade-pro", "monthly", config)).toBe("price_tp_m");
    expect(getPriceId("gc-portfolio-unlimited", "annual", config)).toBe(
      "price_gu_a",
    );
  });

  it("returns undefined for an unknown plan or interval", () => {
    expect(getPriceId("nope", "monthly", config)).toBeUndefined();
    expect(getPriceId("trade-pro", "weekly", config)).toBeUndefined();
  });

  it("returns undefined when the env var is unset", () => {
    expect(getPriceId("trade-pro", "monthly", {})).toBeUndefined();
  });
});

describe("resolvePrice", () => {
  it("resolves a price id to its plan, tier and interval", () => {
    expect(resolvePrice("price_g10_a", config)).toEqual({
      planKey: "gc-portfolio-10",
      companyType: "gc",
      tier: "premium",
      interval: "annual",
    });
    expect(resolvePrice("price_te_m", config)).toEqual({
      planKey: "trade-enterprise",
      companyType: "subcontractor",
      tier: "enterprise",
      interval: "monthly",
    });
  });

  it("returns null for an unknown or missing price id", () => {
    expect(resolvePrice("price_other", config)).toBeNull();
    expect(resolvePrice(undefined, config)).toBeNull();
  });

  it("never matches unset env vars against an undefined price id", () => {
    expect(resolvePrice(undefined, {})).toBeNull();
  });
});
