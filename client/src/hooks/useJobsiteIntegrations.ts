import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../context/auth";
import { listJobsiteIntegrations } from "../services/apiIntegrations";

export const jobsiteIntegrationsQueryKey = (jobsiteId: string) => [
  "jobsiteIntegrations",
  jobsiteId,
];

/**
 * A jobsite's connected Procore/ACC integrations and recent PDF pushes
 * (Phase 9f). Online-only, same shape as `useJobsiteMembers`.
 */
export const useJobsiteIntegrations = (jobsiteId: string) => {
  const { session } = useAuth();

  const query = useQuery({
    queryKey: jobsiteIntegrationsQueryKey(jobsiteId),
    queryFn: () => listJobsiteIntegrations(session!.access_token, jobsiteId),
    enabled: !!session && !!jobsiteId,
  });

  return {
    integrations: query.data?.integrations ?? [],
    recentPushes: query.data?.recentPushes ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
};
