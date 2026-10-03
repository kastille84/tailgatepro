import { CHECKOUT_PLANS } from "../data/checkoutPlans";
import type { CheckoutPlanKey } from "../interfaces/billing";
import type { CompanyType } from "../interfaces/company";
import type { Billing } from "../interfaces/plan";
import { checkoutPath, signupPath } from "./pendingCheckout";

/** Marketing plan id -> the Stripe checkout plans it sells. GC Portfolio is one
 *  card but two prices, so it lists two options. */
const CHECKOUT_OPTIONS: Record<string, { key: CheckoutPlanKey; label?: string }[]> = {
  "trade-pro": [{ key: "trade-pro" }],
  "trade-enterprise": [{ key: "trade-enterprise" }],
  "gc-portfolio": [
    { key: "gc-portfolio-10", label: "up to 10 sites" },
    { key: "gc-portfolio-unlimited", label: "unlimited sites" },
  ],
};

const SITE_PRO_PLAN_ID = "gc-site-pro";

const FREE_PLAN_IDS = ["trade-free", "gc-free"];

export interface PricingCtaContext {
  signedIn: boolean;
  /** Null until the signed-in user's profile has loaded. */
  companyType: CompanyType | null;
  isManager: boolean;
  /** The caller's current marketing plan id (`/api/users/me` `plan`). */
  currentPlanId: string | null;
  billing: Billing;
}

/** A button on a plan card: a router link, or a disabled placeholder. */
export type PlanCta =
  | { label: string; to: string; disabled?: false }
  | { label: string; disabled: true; to?: undefined };

/** What buttons a plan card shows for this visitor. Purely a UI decision — the
 *  server re-checks the company type and role on every checkout. */
export const getPlanCtas = (
  planId: string,
  { signedIn, companyType, isManager, currentPlanId, billing }: PricingCtaContext,
): PlanCta[] => {
  if (FREE_PLAN_IDS.includes(planId)) {
    return signedIn
      ? [{ label: "Go to dashboard", to: "/dashboard" }]
      : [{ label: "Get started free", to: "/signup" }];
  }

  // GC Site Pro is billed per jobsite, so it has no plan-level checkout: the
  // purchase starts from a specific job site on the Projects page.
  if (planId === SITE_PRO_PLAN_ID) {
    if (!signedIn) return [{ label: "Get started", to: "/signup" }];
    if (!companyType) return [{ label: "Loading…", disabled: true }];
    if (companyType !== "gc") {
      return [{ label: "Not available for your account type", disabled: true }];
    }
    if (!isManager) {
      return [{ label: "Ask your admin to upgrade", disabled: true }];
    }
    return [{ label: "Upgrade a job site", to: "/projects" }];
  }

  const options = CHECKOUT_OPTIONS[planId];
  // A plan with no checkout option (none today) simply shows no button.
  if (!options) return [];

  if (!signedIn) {
    return options.map(({ key, label }) => ({
      label: label ? `Get started: ${label}` : "Get started",
      to: signupPath(key, billing),
    }));
  }

  if (!companyType) return [{ label: "Loading…", disabled: true }];
  if (currentPlanId === planId) return [{ label: "Current plan", disabled: true }];
  if (CHECKOUT_PLANS[options[0].key].companyType !== companyType) {
    return [{ label: "Not available for your account type", disabled: true }];
  }
  if (!isManager) {
    return [{ label: "Ask your admin to upgrade", disabled: true }];
  }

  return options.map(({ key, label }) => ({
    label: label ? `Subscribe: ${label}` : "Subscribe",
    to: checkoutPath(key, billing),
  }));
};
