import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { pushGcPolicyTopic } from "../services/apiGc";

/**
 * Pushes (or replaces) the caller's company's current required topic across
 * every active jobsite (Phase 9e, docs/policy-push-design.md). Online-only —
 * a company-wide, manager-only action isn't something to queue for later
 * replay. Invalidates `gcPolicyPush` on success so the page's current-push
 * card and compliance rollup refetch immediately.
 */
export const usePushPolicyTopic = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation<void, Error, string>({
    networkMode: "always",
    mutationFn: (talkId) => pushGcPolicyTopic(session!.access_token, talkId).then(() => undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gcPolicyPush"] });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return {
    pushTopic: mutation.mutateAsync,
    isPushing: mutation.isPending,
  };
};
