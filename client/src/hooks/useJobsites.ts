import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../context/auth";
import { listJobsites } from "../services/apiJobsites";

export const JOBSITES_QUERY_KEY = ["jobsites"];

/**
 * The GC's own jobsites with each roster (pending invites + accepted subs).
 * Online-only (docs/jobsite-design.md) — no offline cache fallback; left at
 * TanStack's default `networkMode` so the query pauses while offline.
 */
export const useJobsites = () => {
  const { session } = useAuth();

  const query = useQuery({
    queryKey: JOBSITES_QUERY_KEY,
    queryFn: () => listJobsites(session!.access_token),
    enabled: !!session,
  });

  return {
    jobsites: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
};
