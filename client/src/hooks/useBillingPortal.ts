import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { createPortalSession } from "../services/apiStripe";

/**
 * Opens the Stripe Customer Portal ("Manage billing") in this tab. Online-only.
 */
export const useBillingPortal = () => {
  const { session } = useAuth();

  const mutation = useMutation<{ url: string }, Error, void>({
    networkMode: "always",
    mutationFn: () => createPortalSession(session!.access_token),
    onSuccess: ({ url }) => {
      window.location.assign(url);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return {
    openPortal: mutation.mutate,
    isOpening: mutation.isPending,
  };
};
