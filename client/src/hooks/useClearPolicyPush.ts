import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { clearGcPolicyPush } from "../services/apiGc";

/**
 * Clears the caller's company's current required topic (Phase 9e,
 * docs/policy-push-design.md). Same online-only, invalidate-on-success shape
 * as `usePushPolicyTopic`.
 */
export const useClearPolicyPush = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation<void, Error, void>({
    networkMode: "always",
    mutationFn: () => clearGcPolicyPush(session!.access_token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gcPolicyPush"] });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return {
    clearPush: mutation.mutateAsync,
    isClearing: mutation.isPending,
  };
};
