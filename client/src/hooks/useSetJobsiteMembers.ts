import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { setJobsiteMembers } from "../services/apiJobsites";
import type { JobsiteMembersResult } from "../interfaces/jobsite";
import { PlanLimitError } from "../utils/PlanLimitError";
import { jobsiteMembersQueryKey } from "./useJobsiteMembers";

interface SetJobsiteMembersVariables {
  jobsiteId: string;
  userIds: string[];
}

/**
 * Replaces a jobsite's assigned superintendents (Phase 9d-2). GC Portfolio
 * only — a 403 PLAN_LIMIT surfaces as `planLimitError` for an inline upgrade
 * prompt, same pattern as `useCreateJobsite`. Online-only: mirrors
 * `useRemoveSubcontractor`.
 */
export const useSetJobsiteMembers = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation<JobsiteMembersResult, Error, SetJobsiteMembersVariables>({
    networkMode: "always",
    mutationFn: ({ jobsiteId, userIds }) =>
      setJobsiteMembers(session!.access_token, jobsiteId, userIds),
    onSuccess: (data, { jobsiteId }) => {
      queryClient.setQueryData(jobsiteMembersQueryKey(jobsiteId), data);
      toast.success("Jobsite team updated");
    },
    onError: (error) => {
      if (error instanceof PlanLimitError) return;
      toast.error(error.message);
    },
  });

  return {
    setJobsiteMembers: mutation.mutateAsync,
    isSaving: mutation.isPending,
    planLimitError: mutation.error instanceof PlanLimitError ? mutation.error : null,
  };
};
