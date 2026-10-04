import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { retryProjectIntegrationPush } from "../services/apiIntegrations";
import { projectIntegrationsQueryKey } from "./useProjectIntegrations";

interface RetryProjectPushVariables {
  pushId: string;
  projectId: string;
}

/** Re-sends a failed Procore/JobTread PDF push (Trade Enterprise). Online-only. */
export const useRetryProjectPush = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation<{ status: "sent" | "failed" }, Error, RetryProjectPushVariables>({
    networkMode: "always",
    mutationFn: ({ pushId }) => retryProjectIntegrationPush(session!.access_token, pushId),
    onSuccess: ({ status }, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: projectIntegrationsQueryKey(projectId) });
      if (status === "sent") {
        toast.success("Report sent");
      } else {
        toast.error("The report could not be sent. Check the connection and try again.");
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return {
    retryPush: mutation.mutate,
    retryingPushId: mutation.isPending ? mutation.variables.pushId : null,
  };
};
