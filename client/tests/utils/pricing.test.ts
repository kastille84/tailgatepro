import { describe, expect, it } from "vitest";

import { planCadence } from "../../src/utils/pricing";
import type { Plan } from "../../src/interfaces/plan";

describe("planCadence", () => {
  const plan: Plan = {
    id: "custom",
    name: "Custom",
    target: "Custom quote",
    price: { monthly: "$99", annual: "$990" },
    features: ["Feature"],
  };

  it("returns null for free and custom quote plans", () => {
    expect(
      planCadence(
        { ...plan, price: { monthly: "$0", annual: "$0" } },
        "monthly",
      ),
    ).toBeNull();
    expect(
      planCadence(
        { ...plan, price: { monthly: "Custom", annual: "Custom" } },
        "annual",
      ),
    ).toBeNull();
  });

  it("adds the monthly cadence for billed plans without a unit", () => {
    expect(planCadence(plan, "monthly")).toBe("/mo");
  });

  it("adds the annual cadence and unit suffix for site-based plans", () => {
    expect(
      planCadence(
        {
          ...plan,
          unit: "/site",
          price: { monthly: "$149", annual: "$1,490" },
        },
        "annual",
      ),
    ).toBe("/site /yr");
  });
});
