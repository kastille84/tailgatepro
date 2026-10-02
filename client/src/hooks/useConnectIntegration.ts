import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { connectIntegration } from "../services/apiIntegrations";
import type {
  ConnectIntegrationInput,
  JobsiteIntegration,
} from "../interfaces/integration";
import { jobsiteIntegrationsQueryKey } from "./useJobsiteIntegrations";

/**
 * Verifies and stores a jobsite's Procore/ACC credentials (Phase 9f). The
 * server rejects bad credentials with a message naming the provider, which
 * surfaces as a toast. Online-only.
 */
export const useConnectIntegration = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation<JobsiteIntegration, Error, ConnectIntegrationInput>({
    networkMode: "always",
    mutationFn: (input) => connectIntegration(session!.access_token, input),
    onSuccess: (_data, { jobsiteId }) => {
      queryClient.invalidateQueries({
        queryKey: jobsiteIntegrationsQueryKey(jobsiteId),
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
