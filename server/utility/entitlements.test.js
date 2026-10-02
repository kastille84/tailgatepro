// Plain CommonJS — see requireAuth.test.js for why.
const {
  PLAN_LIMITS,
  SITE_PLANS,
  hasTranslationAccess,
  hasBrandingAccess,
  getLimits,
  getPlanId,
  hasFullLibrary,
  canAuthorCompanyTalks,
  seatRoleFor,
  effectiveJobsiteLimit,
  hasSiteProAccess,
  hasTradeEnterpriseAccess,
} = require("./entitlements");

describe("entitlements: hasTradeEnterpriseAccess", () => {
  it.each([
    ["subcontractor", "enterprise", true],
    ["subcontractor", "premium", false],
    ["subcontractor", "basic", false],
    ["gc", "enterprise", false],
    [undefined, undefined, false],
  ])("%s on tier %s -> %s", (companyType, tier, expected) => {
    expect(hasTradeEnterpriseAccess(companyType, tier)).toBe(expected);
  });
});

describe("entitlements: hasSiteProAccess", () => {
  it.each([
    ["site_pro", "basic", true],
    ["free", "basic", false],
    ["free", "premium", true],
    ["free", "enterprise", true],
    ["site_pro", "premium", true],
    ["free", undefined, false],
    [null, "basic", false],
  ])("site plan %s on company tier %s -> %s", (sitePlan, companyTier, expected) => {
    expect(hasSiteProAccess({ sitePlan, companyTier })).toBe(expected);
  });
});

describe("entitlements: hasTranslationAccess", () => {
  it.each([
    ["basic", false],
    ["premium", true],
    ["enterprise", true],
  ])("tier %s -> %s", (tier, expected) => {
    expect(hasTranslationAccess(tier)).toBe(expected);
  });
});

describe("entitlements: hasBrandingAccess", () => {
  it.each([
    ["subcontractor", "basic", false],
    ["subcontractor", "premium", true],
    ["subcontractor", "enterprise", true],
    ["gc", "basic", false],
    ["gc", "premium", true],
    ["gc", "enterprise", true],
  ])("%s + %s -> %s (Phase 11c: plan name, not a hasTranslationAccess alias)", (companyType, tier, expected) => {
    expect(hasBrandingAccess(companyType, tier)).toBe(expected);
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

describe("entitlements: hasFullLibrary", () => {
  it.each([
    ["subcontractor", "basic", false],
    ["subcontractor", "premium", true],
    ["subcontractor", "enterprise", true],
    ["gc", "basic", true],
    ["gc", "premium", true],
    [null, null, false],
  ])("%s + %s -> %s", (companyType, tier, expected) => {
    expect(hasFullLibrary(companyType, tier)).toBe(expected);
  });
});

describe("entitlements: canAuthorCompanyTalks", () => {
  it.each([
    ["subcontractor", "basic", true],
    ["subcontractor", "premium", true],
    ["subcontractor", "enterprise", true],
    ["gc", "basic", false],
    ["gc", "premium", true],
    ["gc", "enterprise", true],
    ["gc", "platinum", false],
  ])("%s + %s -> %s", (companyType, tier, expected) => {
    expect(canAuthorCompanyTalks(companyType, tier)).toBe(expected);
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
