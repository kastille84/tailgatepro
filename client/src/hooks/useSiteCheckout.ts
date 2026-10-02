import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { createSiteCheckoutSession } from "../services/apiStripe";
import type { Billing } from "../interfaces/plan";

interface StartSiteCheckoutVariables {
  jobsiteId: string;
  interval: Billing;
}

/**
 * Starts a hosted Stripe Checkout for one jobsite's GC Site Pro subscription
 * and sends the browser there. Online-only. Errors are toasted (the picker
 * modal has no inline error slot), e.g. "This jobsite is already on Site Pro".
 */
export const useSiteCheckout = () => {
  const { session } = useAuth();

  const mutation = useMutation<{ url: string }, Error, StartSiteCheckoutVariables>({
    networkMode: "always",
    mutationFn: ({ jobsiteId, interval }) =>
      createSiteCheckoutSession(session!.access_token, jobsiteId, interval),
    onSuccess: ({ url }) => {
      window.location.assign(url);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return {
    startSiteCheckout: mutation.mutate,
    isStarting: mutation.isPending,
  };
};
