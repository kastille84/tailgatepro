import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { disconnectIntegration } from "../services/apiIntegrations";
import type { IntegrationProvider } from "../interfaces/integration";
import { jobsiteIntegrationsQueryKey } from "./useJobsiteIntegrations";

interface DisconnectIntegrationVariables {
  jobsiteId: string;
  provider: IntegrationProvider;
}

/** Removes a jobsite's stored Procore/ACC credentials (Phase 9f). Online-only. */
export const useDisconnectIntegration = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation<void, Error, DisconnectIntegrationVariables>({
    networkMode: "always",
    mutationFn: ({ jobsiteId, provider }) =>
      disconnectIntegration(session!.access_token, jobsiteId, provider),
    onSuccess: (_data, { jobsiteId }) => {
      queryClient.invalidateQueries({
        queryKey: jobsiteIntegrationsQueryKey(jobsiteId),
      });
      toast.success("Integration disconnected");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return {
    disconnectIntegration: mutation.mutateAsync,
    isDisconnecting: mutation.isPending,
  };
};
