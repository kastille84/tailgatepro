import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { updateJobsite } from "../services/apiJobsites";
import { JOBSITES_QUERY_KEY } from "./useJobsites";
import type { JobsitePatch, JobsiteSummary } from "../interfaces/jobsite";

interface UpdateJobsiteVariables {
  id: string;
  patch: JobsitePatch;
}

/**
 * Renames, changes the status of, or archives/restores a jobsite. Online-only
 * like `useCreateJobsite`. Refetches the jobsite list on success.
 */
export const useUpdateJobsite = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation<JobsiteSummary, Error, UpdateJobsiteVariables>({
    networkMode: "always",
    mutationFn: ({ id, patch }) =>
      updateJobsite(session!.access_token, id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: JOBSITES_QUERY_KEY });
      toast.success("Job site updated");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return {
    updateJobsite: mutation.mutateAsync,
    isUpdating: mutation.isPending,
  };
};
