import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../context/auth";
import { listJobsiteMembers } from "../services/apiJobsites";

export const jobsiteMembersQueryKey = (jobsiteId: string) => ["jobsiteMembers", jobsiteId];

/**
 * A jobsite's assignable superintendents (Phase 9d-2), for the members
 * checklist. Online-only, same shape as `useJobsites` — no offline cache
 * fallback, since assigning superintendents is a manager-only, online action.
 */
export const useJobsiteMembers = (jobsiteId: string) => {
  const { session } = useAuth();

  const query = useQuery({
    queryKey: jobsiteMembersQueryKey(jobsiteId),
    queryFn: () => listJobsiteMembers(session!.access_token, jobsiteId),
    enabled: !!session && !!jobsiteId,
  });

  return {
    members: query.data?.members ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
};
