import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../context/auth";
import { getBillingSummary } from "../services/apiStripe";
import { useCurrentUser } from "./useCurrentUser";

export const BILLING_STATUS_QUERY_KEY = ["billingStatus"];

interface UseBillingStatusOptions {
  /** Refetch every couple of seconds — used right after returning from Stripe,
   *  while the webhook is still writing the new subscription. */
  poll?: boolean;
}

const POLL_INTERVAL_MS = 2000;

/**
 * The company's subscription summary (`GET /api/stripe/billing`). Only enabled
 * for a manager role — the endpoint 403s for anyone else, so a foreman never
 * fires the request.
 */
export const useBillingStatus = ({ poll = false }: UseBillingStatusOptions = {}) => {
  const { session } = useAuth();
  const { isManagerRole } = useCurrentUser();

  const query = useQuery({
    queryKey: BILLING_STATUS_QUERY_KEY,
    queryFn: () => getBillingSummary(session!.access_token),
    enabled: !!session && isManagerRole,
    refetchInterval: poll ? POLL_INTERVAL_MS : false,
  });

  return {
    billing: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
  };
};
