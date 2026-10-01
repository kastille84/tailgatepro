import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { retryIntegrationPush } from "../services/apiIntegrations";

interface RetryPushVariables {
  pushId: string;
  jobsiteId: string;
}

/** Re-sends a failed Procore/ACC PDF push (Phase 9f). Online-only. */
export const useRetryPush = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation<{ status: "sent" | "failed" }, Error, RetryPushVariables>({
    networkMode: "always",
    mutationFn: ({ pushId }) => retryIntegrationPush(session!.access_token, pushId),
    onSuccess: ({ status }, { jobsiteId }) => {
      queryClient.invalidateQueries({ queryKey: ["jobsiteIntegrations", jobsiteId] });
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
