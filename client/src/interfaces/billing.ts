import type { Billing } from "./plan";

/** The server's checkout plan keys (`server/utility/stripePlans.js`). Finer
 *  grained than the marketing plan ids because GC Portfolio is sold as two
 *  prices (10 sites / unlimited sites). */
export type CheckoutPlanKey =
  | "trade-pro"
  | "trade-enterprise"
  | "gc-portfolio-10"
  | "gc-portfolio-unlimited";

/** `GET /api/stripe/billing` — what Settings → Billing shows. */
export interface BillingSummary {
  hasBillingAccount: boolean;
  /** Stripe's subscription status (`active`, `past_due`, `canceled`, ...), or
   *  null for a company that never subscribed. */
  subscriptionStatus: string | null;
  billingInterval: Billing | null;
  /** ISO timestamp of the end of the paid period. */
  currentPeriodEnd: string | null;
}

/** A plan choice made on /pricing, carried through signup/login to checkout. */
export interface PendingCheckout {
  plan: CheckoutPlanKey;
  interval: Billing;
}
