import type { CheckoutPlanKey } from "../interfaces/billing";
import type { CompanyType } from "../interfaces/company";
import type { Billing } from "../interfaces/plan";

/**
 * The plans purchasable through Stripe Checkout, keyed the way the server
 * expects (`server/utility/stripePlans.js`). `companyType` is a UI hint so a
 * wrong-type plan is caught early; the server enforces it regardless.
 */
export const CHECKOUT_PLANS: Record<
  CheckoutPlanKey,
  { name: string; companyType: CompanyType }
> = {
  "trade-pro": { name: "Trade Pro", companyType: "subcontractor" },
  "trade-enterprise": { name: "Trade Enterprise", companyType: "subcontractor" },
  "gc-portfolio-10": {
    name: "GC Portfolio (up to 10 sites)",
    companyType: "gc",
  },
  "gc-portfolio-unlimited": {
    name: "GC Portfolio (unlimited sites)",
    companyType: "gc",
  },
};

export const isCheckoutPlanKey = (
  value: string | null | undefined,
): value is CheckoutPlanKey =>
  typeof value === "string" && Object.hasOwn(CHECKOUT_PLANS, value);

export const isBillingInterval = (
  value: string | null | undefined,
): value is Billing => value === "monthly" || value === "annual";
