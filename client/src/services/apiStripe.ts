import { fetchWithTimeout } from "../utils/fetchWithTimeout";
import { AlreadySubscribedError } from "../utils/AlreadySubscribedError";
import type { BillingSummary, CheckoutPlanKey } from "../interfaces/billing";
import type { Billing } from "../interfaces/plan";

const GENERIC_ERROR = "Something went wrong. Please try again.";

const authHeaders = (accessToken: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${accessToken}`,
});

/** Unwraps the server's `{ success, data }` envelope, throwing its message.
 *  A 409 `ALREADY_SUBSCRIBED` throws an `AlreadySubscribedError`. */
const unwrap = async <T>(res: Response): Promise<T> => {
  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    if (body?.data?.code === "ALREADY_SUBSCRIBED") {
      throw new AlreadySubscribedError(body.error ?? GENERIC_ERROR);
    }
    throw new Error(body?.error ?? GENERIC_ERROR);
  }

  return body.data as T;
};

/** GET /api/stripe/billing — manager-only (server-enforced). */
export const getBillingSummary = async (
  accessToken: string,
): Promise<BillingSummary> => {
  const res = await fetchWithTimeout("/api/stripe/billing", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return unwrap<BillingSummary>(res);
};

/** POST /api/stripe/checkout-session — returns the hosted Checkout URL. */
export const createCheckoutSession = async (
  accessToken: string,
  planId: CheckoutPlanKey,
  interval: Billing,
): Promise<{ url: string }> => {
  const res = await fetchWithTimeout("/api/stripe/checkout-session", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ planId, interval }),
  });
  return unwrap<{ url: string }>(res);
};

/** POST /api/stripe/site-checkout-session — Checkout URL for one jobsite's
 *  GC Site Pro subscription. */
export const createSiteCheckoutSession = async (
  accessToken: string,
  jobsiteId: string,
  interval: Billing,
): Promise<{ url: string }> => {
  const res = await fetchWithTimeout("/api/stripe/site-checkout-session", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ jobsiteId, interval }),
  });
  return unwrap<{ url: string }>(res);
};

/** POST /api/stripe/portal-session — returns the Customer Portal URL. */
export const createPortalSession = async (
  accessToken: string,
): Promise<{ url: string }> => {
  const res = await fetchWithTimeout("/api/stripe/portal-session", {
    method: "POST",
    headers: authHeaders(accessToken),
  });
  return unwrap<{ url: string }>(res);
};
