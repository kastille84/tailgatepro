export type Audience = "sub" | "gc";

export type Billing = "monthly" | "annual";

export interface Plan {
  id: string;
  name: string;
  /** One-line description of who the plan is for. */
  target: string;
  price: Record<Billing, string>;
  /** Small word shown before the price when it's a starting price, e.g. "From". */
  pricePrefix?: string;
  /** Unit qualifier shown before the cadence, e.g. "/site". */
  unit?: string;
  /** Small line under the price, only shown on the annual view. */
  annualSub?: string;
  /** Name of the plan below this one; its features are all included here. */
  inheritsFrom?: string;
  features: string[];
  /** Subset of `features` that is not built yet; shown with a "Coming soon" tag. */
  comingSoon?: string[];
  featured?: boolean;
}
