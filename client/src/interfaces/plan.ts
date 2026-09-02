export type Audience = "sub" | "gc";

export type Billing = "monthly" | "annual";

export interface Plan {
  id: string;
  name: string;
  /** One-line description of who the plan is for. */
  target: string;
  price: Record<Billing, string>;
  /** Unit qualifier shown before the cadence, e.g. "/site". */
  unit?: string;
  /** Small line under the price, only shown on the annual view. */
  annualSub?: string;
  features: string[];
  featured?: boolean;
}
