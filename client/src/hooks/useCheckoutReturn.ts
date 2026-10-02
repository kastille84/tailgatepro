import { useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useBillingStatus } from "./useBillingStatus";

/** How long to wait for the webhook before giving up and telling the user the
 *  plan will appear shortly. */
export const CHECKOUT_CONFIRM_TIMEOUT_MS = 30_000;

const ACTIVE_STATUSES = ["active", "trialing"];

/**
 * Handles the return from Stripe Checkout (`/settings?checkout=success|cancel`).
 *
 * The redirect proves nothing — only the Stripe webhook changes the plan. So on
 * `success` this polls the billing summary until the subscription shows up as
 * active, then refreshes the current user (plan, limits) and confirms with a
 * toast; after `CHECKOUT_CONFIRM_TIMEOUT_MS` it stops polling and says the plan
 * will appear shortly. On `cancel` it just says nothing was charged. Either
 * way the query param is removed afterwards so a refresh doesn't repeat it.
 */
export const useCheckoutReturn = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const result = searchParams.get("checkout");
  const isConfirming = result === "success";
  const { billing } = useBillingStatus({ poll: isConfirming });
  const isActive = ACTIVE_STATUSES.includes(billing?.subscriptionStatus ?? "");

  const clearParam = useCallback(() => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete("checkout");
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  useEffect(() => {
    if (result === "cancel") {
      toast("Checkout canceled. You haven't been charged.");
      clearParam();
    }
  }, [result, clearParam]);

  useEffect(() => {
    if (isConfirming && isActive) {
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      toast.success("Your plan is active. Thanks for subscribing!");
      clearParam();
    }
  }, [isConfirming, isActive, queryClient, clearParam]);

  useEffect(() => {
    if (!isConfirming) return undefined;
    const timer = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      toast("Payment received. Your plan will update in a moment.");
      clearParam();
    }, CHECKOUT_CONFIRM_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isConfirming, queryClient, clearParam]);

  return { isConfirming };
};
