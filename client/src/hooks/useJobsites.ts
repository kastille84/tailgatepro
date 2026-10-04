import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../context/auth";
import { listJobsites } from "../services/apiJobsites";

export const JOBSITES_QUERY_KEY = ["jobsites"];

const POLL_INTERVAL_MS = 2000;

interface UseJobsitesOptions {
  /** Refetch every 2s, e.g. while waiting for the Stripe webhook to flip a
   *  jobsite to Site Pro after Checkout. */
  poll?: boolean;
}

/**
 * The GC's own jobsites with each roster (pending invites + accepted subs).
 * Online-only (docs/jobsite-design.md) — no offline cache fallback; left at
 * TanStack's default `networkMode` so the query pauses while offline.
 */
export const useJobsites = ({ poll = false }: UseJobsitesOptions = {}) => {
  const { session } = useAuth();

  const query = useQuery({
    queryKey: JOBSITES_QUERY_KEY,
    queryFn: () => listJobsites(session!.access_token),
    enabled: !!session,
    refetchInterval: poll ? POLL_INTERVAL_MS : false,
  });

  return {
    jobsites: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
};
