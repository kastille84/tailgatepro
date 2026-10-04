import { useMutation } from "@tanstack/react-query";

import { useAuth } from "../context/auth";
import { createCheckoutSession } from "../services/apiStripe";
import type { CheckoutPlanKey } from "../interfaces/billing";
import type { Billing } from "../interfaces/plan";

interface StartCheckoutVariables {
  plan: CheckoutPlanKey;
  interval: Billing;
}

/**
 * Starts a hosted Stripe Checkout for a plan and sends the browser there.
 * Online-only. Errors are returned (not toasted) so the /checkout page can
 * show them inline, and can tell an `AlreadySubscribedError` apart to redirect
 * to Settings → Billing.
 */
export const useCheckout = () => {
  const { session } = useAuth();

  const mutation = useMutation<{ url: string }, Error, StartCheckoutVariables>({
    networkMode: "always",
    mutationFn: ({ plan, interval }) =>
      createCheckoutSession(session!.access_token, plan, interval),
    onSuccess: ({ url }) => {
      window.location.assign(url);
    },
  });

  return {
    startCheckout: mutation.mutate,
    isStarting: mutation.isPending,
    error: mutation.error,
  };
};
