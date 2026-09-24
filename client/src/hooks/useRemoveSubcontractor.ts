import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { removeSubcontractor } from "../services/apiJobsites";
import { JOBSITES_QUERY_KEY } from "./useJobsites";

interface RemoveSubcontractorVariables {
  jobsiteId: string;
  subId: string;
}

/**
 * Removes a subcontractor from a jobsite, or cancels its pending invite.
 * Online-only. Refetches the jobsite list on success.
 */
export const useRemoveSubcontractor = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation<void, Error, RemoveSubcontractorVariables>({
    networkMode: "always",
    mutationFn: ({ jobsiteId, subId }) =>
      removeSubcontractor(session!.access_token, jobsiteId, subId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: JOBSITES_QUERY_KEY });
      toast.success("Subcontractor removed");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return {
    removeSubcontractor: mutation.mutateAsync,
    isRemoving: mutation.isPending,
  };
};
