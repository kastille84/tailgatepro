import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { verifyGcMeetingSeal } from "../services/apiGc";
import type { SealVerification } from "../interfaces/meetingLog";

/**
 * GC-side sibling of `useVerifyMeetingSeal` (Phase 9e) — same on-demand,
 * fetched-on-click shape, hitting the GC-scoped verify endpoint instead of
 * the sub's own.
 */
export const useVerifyGcMeetingSeal = () => {
  const { session } = useAuth();

  const mutation = useMutation<SealVerification, Error, string>({
    networkMode: "always",
    mutationFn: (id) => verifyGcMeetingSeal(session!.access_token, id),
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return {
    verifySeal: mutation.mutate,
    result: mutation.data,
    isPending: mutation.isPending,
    isError: mutation.isError,
    reset: mutation.reset,
    // See useVerifyMeetingSeal's comment — the same shared-mutation-across-a-
    // list caveat applies here.
    verifyingId: mutation.variables,
  };
};
