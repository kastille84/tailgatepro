import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { connectProjectIntegration } from "../services/apiIntegrations";
import type {
  ConnectProjectIntegrationInput,
  JobsiteIntegration,
} from "../interfaces/integration";
import { projectIntegrationsQueryKey } from "./useProjectIntegrations";

/**
 * Verifies and stores a project's Procore/JobTread credentials (Trade
 * Enterprise). The server rejects bad credentials with a message naming the
 * provider, which surfaces as a toast. Online-only.
 */
export const useConnectProjectIntegration = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation<JobsiteIntegration, Error, ConnectProjectIntegrationInput>({
    networkMode: "always",
    mutationFn: (input) => connectProjectIntegration(session!.access_token, input),
    onSuccess: (_data, { tailgateProjectId }) => {
      queryClient.invalidateQueries({
        queryKey: projectIntegrationsQueryKey(tailgateProjectId),
      });
      toast.success("Integration connected");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return {
    connectIntegration: mutation.mutateAsync,
    isConnecting: mutation.isPending,
  };
};
