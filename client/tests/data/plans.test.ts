import { describe, it, expect } from "vitest";

import { SUB_PLANS, GC_PLANS } from "../../src/data/plans";

describe("plans data", () => {
  it.each([...SUB_PLANS, ...GC_PLANS].map((plan) => [plan.name, plan] as const))(
    "%s only flags comingSoon features that exist in its features list",
    (_name, plan) => {
      for (const feature of plan.comingSoon ?? []) {
        expect(plan.features).toContain(feature);
      }
    },
  );
});
