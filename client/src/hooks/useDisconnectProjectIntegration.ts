import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { disconnectProjectIntegration } from "../services/apiIntegrations";
import type { IntegrationProvider } from "../interfaces/integration";
import { projectIntegrationsQueryKey } from "./useProjectIntegrations";

interface DisconnectProjectIntegrationVariables {
  projectId: string;
  provider: IntegrationProvider;
}

/** Removes a project's stored Procore/JobTread credentials (Trade Enterprise). Online-only. */
export const useDisconnectProjectIntegration = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation<void, Error, DisconnectProjectIntegrationVariables>({
    networkMode: "always",
    mutationFn: ({ projectId, provider }) =>
      disconnectProjectIntegration(session!.access_token, projectId, provider),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({
        queryKey: projectIntegrationsQueryKey(projectId),
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
