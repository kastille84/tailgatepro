import { describe, expect, it } from "vitest";

import {
  getPlanCtas,
  type PricingCtaContext,
} from "../../src/utils/pricingCtas";

const ctx = (overrides: Partial<PricingCtaContext> = {}): PricingCtaContext => ({
  signedIn: false,
  companyType: null,
  isManager: false,
  currentPlanId: null,
  billing: "monthly",
  ...overrides,
});

const signedInSub = (overrides: Partial<PricingCtaContext> = {}) =>
  ctx({
    signedIn: true,
    companyType: "subcontractor",
    isManager: true,
    currentPlanId: "trade-free",
    ...overrides,
  });

describe("getPlanCtas", () => {
  describe("free plans", () => {
    it("send a visitor to signup", () => {
      expect(getPlanCtas("trade-free", ctx())).toEqual([
        { label: "Get started free", to: "/signup" },
      ]);
    });

    it("send a signed-in user to the dashboard", () => {
      expect(getPlanCtas("gc-free", signedInSub())).toEqual([
        { label: "Go to dashboard", to: "/dashboard" },
      ]);
    });
  });

  describe("GC Site Pro (not purchasable yet)", () => {
    it("always shows the waitlist", () => {
      expect(getPlanCtas("gc-site-pro", ctx())).toEqual([
        { label: "Join the waitlist", waitlist: true },
      ]);
      expect(getPlanCtas("gc-site-pro", signedInSub())).toEqual([
        { label: "Join the waitlist", waitlist: true },
      ]);
    });
  });

  describe("visitors on a paid plan", () => {
    it("go to signup carrying the plan and selected interval", () => {
      expect(getPlanCtas("trade-pro", ctx({ billing: "annual" }))).toEqual([
        { label: "Get started", to: "/signup?plan=trade-pro&interval=annual" },
      ]);
    });

    it("get one button per GC Portfolio size", () => {
      expect(getPlanCtas("gc-portfolio", ctx())).toEqual([
        {
          label: "Get started: up to 10 sites",
          to: "/signup?plan=gc-portfolio-10&interval=monthly",
        },
        {
          label: "Get started: unlimited sites",
          to: "/signup?plan=gc-portfolio-unlimited&interval=monthly",
        },
      ]);
    });
  });

  describe("signed-in users on a paid plan", () => {
    it("go straight to checkout when they are a manager of the matching type", () => {
      expect(getPlanCtas("trade-enterprise", signedInSub({ billing: "annual" }))).toEqual([
        {
          label: "Subscribe",
          to: "/checkout?plan=trade-enterprise&interval=annual",
        },
      ]);
    });

    it("get one Subscribe button per GC Portfolio size", () => {
      const gc = ctx({
        signedIn: true,
        companyType: "gc",
        isManager: true,
        currentPlanId: "gc-free",
      });
      expect(getPlanCtas("gc-portfolio", gc)).toEqual([
        {
          label: "Subscribe: up to 10 sites",
          to: "/checkout?plan=gc-portfolio-10&interval=monthly",
        },
        {
          label: "Subscribe: unlimited sites",
          to: "/checkout?plan=gc-portfolio-unlimited&interval=monthly",
        },
      ]);
    });

    it("show a loading state until the profile has loaded", () => {
      expect(getPlanCtas("trade-pro", ctx({ signedIn: true }))).toEqual([
        { label: "Loading…", disabled: true },
      ]);
    });

    it("mark their own plan as the current plan", () => {
      expect(
        getPlanCtas("trade-pro", signedInSub({ currentPlanId: "trade-pro" })),
      ).toEqual([{ label: "Current plan", disabled: true }]);
    });

    it("disable a plan for the other company type", () => {
      expect(getPlanCtas("gc-portfolio", signedInSub())).toEqual([
        { label: "Not available for your account type", disabled: true },
      ]);
    });

    it("ask a non-manager to involve their admin", () => {
      expect(getPlanCtas("trade-pro", signedInSub({ isManager: false }))).toEqual([
        { label: "Ask your admin to upgrade", disabled: true },
      ]);
    });
  });
});
