// Plain CommonJS — see requireAuth.test.js for why.
const {
  PLAN_LIMITS,
  SITE_PLANS,
  hasTranslationAccess,
  hasBrandingAccess,
  getLimits,
  getPlanId,
  seatRoleFor,
  effectiveJobsiteLimit,
} = require("./entitlements");

describe("entitlements: existing gates", () => {
  it.each([
    ["basic", false],
    ["premium", true],
    ["enterprise", true],
  ])("tier %s -> translation/branding %s", (tier, expected) => {
    expect(hasTranslationAccess(tier)).toBe(expected);
    expect(hasBrandingAccess(tier)).toBe(expected);
  });
});

describe("entitlements: seatRoleFor", () => {
  it("Trade Free counts every role (one person total)", () => {
    expect(seatRoleFor("subcontractor", "basic")).toBeNull();
  });

  it.each(["premium", "enterprise"])("Trade %s counts foremen only", (tier) => {
    expect(seatRoleFor("subcontractor", tier)).toBe("foreman");
  });
});

describe("entitlements: plan resolution", () => {
  it.each([
    ["subcontractor", "basic", "trade-free"],
    ["subcontractor", "premium", "trade-pro"],
    ["subcontractor", "enterprise", "trade-enterprise"],
    ["gc", "basic", "gc-free"],
    ["gc", "premium", "gc-portfolio"],
    ["gc", "enterprise", "gc-portfolio"],
  ])("%s + %s -> %s", (companyType, tier, planId) => {
    expect(getPlanId(companyType, tier)).toBe(planId);
    expect(getLimits(companyType, tier)).toBe(PLAN_LIMITS[`${companyType}:${tier}`]);
  });

  it("falls back to the most restrictive plan for unknown or missing values", () => {
    expect(getPlanId(null, null)).toBe("trade-free");
    expect(getPlanId("gc", "platinum")).toBe("trade-free");
  });

  it("defines the documented limits", () => {
    expect(getLimits("subcontractor", "basic")).toMatchObject({
      foremanSeats: 1,
      historyDays: 30,
    });
    expect(getLimits("subcontractor", "premium")).toMatchObject({
      foremanSeats: 8,
      archiveYears: 5,
    });
    expect(getLimits("subcontractor", "enterprise").foremanSeats).toBeNull();
    expect(getLimits("gc", "basic")).toMatchObject({
      activeJobsites: 1,
      unlockedSubs: 1,
    });
    expect(getLimits("gc", "premium").activeJobsites).toBe(10);
    expect(getLimits("gc", "enterprise").activeJobsites).toBeNull();
  });

  it("exposes the per-jobsite plan values", () => {
    expect(SITE_PLANS).toEqual(["free", "site_pro"]);
  });
});

describe("entitlements: effectiveJobsiteLimit", () => {
  it("adds one jobsite per paid Site Pro site on the free plan", () => {
    expect(effectiveJobsiteLimit({ tier: "basic" })).toBe(1);
    expect(effectiveJobsiteLimit({ tier: "basic", paidSiteCount: 3 })).toBe(4);
  });

  it("uses the Portfolio cap regardless of paid site count", () => {
    expect(effectiveJobsiteLimit({ tier: "premium", paidSiteCount: 2 })).toBe(10);
  });

  it("is unlimited (null) for unlimited Portfolio", () => {
    expect(effectiveJobsiteLimit({ tier: "enterprise" })).toBeNull();
  });
});
