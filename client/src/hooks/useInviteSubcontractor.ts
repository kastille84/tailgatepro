import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { inviteSubcontractor } from "../services/apiJobsites";
import { JOBSITES_QUERY_KEY } from "./useJobsites";
import type { InviteSubcontractorResult } from "../interfaces/jobsite";

interface InviteSubcontractorVariables {
  jobsiteId: string;
  email: string;
}

/**
 * Emails a subcontractor an invite to a jobsite (Phase 8d). Online-only — the
 * server sends the email as a side effect. Refetches the jobsite list so the
 * new pending roster row shows up.
 */
export const useInviteSubcontractor = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation<
    InviteSubcontractorResult,
    Error,
    InviteSubcontractorVariables
  >({
    networkMode: "always",
    mutationFn: ({ jobsiteId, email }) =>
      inviteSubcontractor(session!.access_token, jobsiteId, email),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: JOBSITES_QUERY_KEY });
      toast.success(`Invite sent to ${data.email}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return {
    inviteSubcontractor: mutation.mutateAsync,
    isInviting: mutation.isPending,
  };
};
