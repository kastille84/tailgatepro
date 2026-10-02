import { describe, expect, it } from "vitest";

import {
  CHECKOUT_PLANS,
  isBillingInterval,
  isCheckoutPlanKey,
} from "../../src/data/checkoutPlans";

describe("checkoutPlans", () => {
  it("knows the four server plan keys and their company types", () => {
    expect(Object.keys(CHECKOUT_PLANS)).toEqual([
      "trade-pro",
      "trade-enterprise",
      "gc-portfolio-10",
      "gc-portfolio-unlimited",
    ]);
    expect(CHECKOUT_PLANS["trade-pro"].companyType).toBe("subcontractor");
    expect(CHECKOUT_PLANS["gc-portfolio-10"].companyType).toBe("gc");
  });

  describe("isCheckoutPlanKey", () => {
    it("accepts a known key", () => {
      expect(isCheckoutPlanKey("trade-enterprise")).toBe(true);
    });

    it("rejects unknown, empty and inherited-property values", () => {
      expect(isCheckoutPlanKey("nope")).toBe(false);
      expect(isCheckoutPlanKey("toString")).toBe(false);
      expect(isCheckoutPlanKey(null)).toBe(false);
      expect(isCheckoutPlanKey(undefined)).toBe(false);
    });
  });

  describe("isBillingInterval", () => {
    it("accepts monthly and annual only", () => {
      expect(isBillingInterval("monthly")).toBe(true);
      expect(isBillingInterval("annual")).toBe(true);
      expect(isBillingInterval("weekly")).toBe(false);
      expect(isBillingInterval(null)).toBe(false);
    });
  });
});
