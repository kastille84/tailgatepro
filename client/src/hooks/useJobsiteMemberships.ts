import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../context/auth";
import { listJobsiteMemberships } from "../services/apiJobsites";

export const JOBSITE_MEMBERSHIPS_QUERY_KEY = ["jobsiteMemberships"];

/**
 * A subcontractor company's own jobsites with their meeting cadence settings
 * (Phase 11f). Online-only, like `useJobsites` — left at TanStack's default
 * `networkMode` so it pauses while offline.
 */
export const useJobsiteMemberships = ({ enabled = true } = {}) => {
  const { session } = useAuth();

  const query = useQuery({
    queryKey: JOBSITE_MEMBERSHIPS_QUERY_KEY,
    queryFn: () => listJobsiteMemberships(session!.access_token),
    enabled: enabled && !!session,
  });

  return {
    memberships: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
};
