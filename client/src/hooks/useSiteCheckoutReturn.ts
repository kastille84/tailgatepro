import { useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";

import { useJobsites } from "./useJobsites";

/** How long to wait for the webhook before telling the user the upgrade will
 *  appear shortly. */
export const SITE_CHECKOUT_CONFIRM_TIMEOUT_MS = 30_000;

/**
 * Handles the return from a Site Pro Checkout
 * (`/projects?siteCheckout=success|cancel&jobsiteId=...`).
 *
 * The redirect proves nothing: only the Stripe webhook flips `jobsites.plan`.
 * So on `success` this polls the jobsite list until that jobsite reads
 * `site_pro`, then confirms with a toast; after
 * `SITE_CHECKOUT_CONFIRM_TIMEOUT_MS` it stops and says the upgrade will appear
 * shortly. On `cancel` it says nothing was charged. Either way the query
 * params are removed so a refresh doesn't repeat it.
 */
export const useSiteCheckoutReturn = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const result = searchParams.get("siteCheckout");
  const jobsiteId = searchParams.get("jobsiteId");
  const isConfirming = result === "success";
  const { jobsites } = useJobsites({ poll: isConfirming });
  const isUpgraded = jobsites.some(
    (jobsite) => jobsite.id === jobsiteId && jobsite.plan === "site_pro",
  );

  const clearParams = useCallback(() => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete("siteCheckout");
        next.delete("jobsiteId");
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  useEffect(() => {
    if (result === "cancel") {
      toast("Checkout canceled. You haven't been charged.");
      clearParams();
    }
  }, [result, clearParams]);

  useEffect(() => {
    if (isConfirming && isUpgraded) {
      toast.success("Site Pro is active. Thanks for upgrading!");
      clearParams();
    }
  }, [isConfirming, isUpgraded, clearParams]);

  useEffect(() => {
    if (!isConfirming) return undefined;
    const timer = setTimeout(() => {
      toast("Payment received. Site Pro will appear in a moment.");
      clearParams();
    }, SITE_CHECKOUT_CONFIRM_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isConfirming, clearParams]);

  return { isConfirming };
};
