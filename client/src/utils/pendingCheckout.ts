import {
  isBillingInterval,
  isCheckoutPlanKey,
} from "../data/checkoutPlans";
import type { CheckoutPlanKey, PendingCheckout } from "../interfaces/billing";
import type { Billing } from "../interfaces/plan";

const STORAGE_KEY = "tailgatepro.pendingCheckout";
/** A remembered plan choice expires, so a stale one can't redirect an ordinary
 *  login to checkout days later. Covers the signup → email-confirm → login gap. */
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;

/** `/checkout?plan=...&interval=...` for a chosen plan. */
export const checkoutPath = (plan: CheckoutPlanKey, interval: Billing): string =>
  `/checkout?plan=${plan}&interval=${interval}`;

/** `/signup?plan=...&interval=...` — signup that ends at checkout. */
export const signupPath = (plan: CheckoutPlanKey, interval: Billing): string =>
  `/signup?plan=${plan}&interval=${interval}`;

/** A valid `?plan=&interval=` pair from a URL, or null if either is missing or
 *  unknown. */
export const parsePendingCheckout = (
  params: URLSearchParams,
): PendingCheckout | null => {
  const plan = params.get("plan");
  const interval = params.get("interval");
  return isCheckoutPlanKey(plan) && isBillingInterval(interval)
    ? { plan, interval }
    : null;
};

/** Remembers a plan choice made before the user had an account, so signup →
 *  email confirmation → login can still end at checkout. localStorage (not
 *  sessionStorage) because the confirmation link often opens in a new tab.
 *  Every access is guarded: storage can throw or be unavailable (private
 *  windows, blocked site data), and checkout must still work without it. */
export const savePendingCheckout = (pending: PendingCheckout): void => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...pending, savedAt: Date.now() }),
    );
  } catch {
    // Storage unavailable: the user just re-picks a plan after logging in.
  }
};

export const readPendingCheckout = (): PendingCheckout | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as
      | (Partial<PendingCheckout> & { savedAt?: unknown })
      | null;
    if (
      typeof parsed?.savedAt !== "number" ||
      Date.now() - parsed.savedAt > PENDING_TTL_MS
    ) {
      return null;
    }
    if (isCheckoutPlanKey(parsed.plan) && isBillingInterval(parsed.interval)) {
      return { plan: parsed.plan, interval: parsed.interval };
    }
    return null;
  } catch {
    return null;
  }
};

export const clearPendingCheckout = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
};
