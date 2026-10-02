import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../context/auth";
import { listProjectIntegrations } from "../services/apiIntegrations";

export const projectIntegrationsQueryKey = (projectId: string) => [
  "projectIntegrations",
  projectId,
];

/**
 * A sub's project's connected Procore/JobTread integrations and recent PDF
 * pushes (Trade Enterprise). Online-only, same shape as `useJobsiteIntegrations`.
 */
export const useProjectIntegrations = (projectId: string) => {
  const { session } = useAuth();

  const query = useQuery({
    queryKey: projectIntegrationsQueryKey(projectId),
    queryFn: () => listProjectIntegrations(session!.access_token, projectId),
    enabled: !!session && !!projectId,
  });

  return {
    enterprise: query.data?.enterprise ?? false,
    integrations: query.data?.integrations ?? [],
    recentPushes: query.data?.recentPushes ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
};
