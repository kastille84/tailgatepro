import type { Billing, Plan } from "../interfaces/plan";

/**
 * The suffix shown next to a plan's price (e.g. "/mo", "/site /yr"), or `null`
 * when there is nothing to append — free ("$0") and custom-quote plans.
 */
export const planCadence = (plan: Plan, billing: Billing): string | null => {
  const value = plan.price[billing];
  if (value === "Custom" || value === "$0") return null;

  const suffix = billing === "monthly" ? "/mo" : "/yr";
  return plan.unit ? `${plan.unit} ${suffix}` : suffix;
};
