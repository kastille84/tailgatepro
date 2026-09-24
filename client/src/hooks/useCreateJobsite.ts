import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { createJobsite } from "../services/apiJobsites";
import { JOBSITES_QUERY_KEY } from "./useJobsites";
import type { JobsiteSummary } from "../interfaces/jobsite";

/**
 * Creates a GC-owned jobsite. Online-only, no outbox: the server mints the id
 * (docs/jobsite-design.md's offline-sync exception), so `networkMode:
 * "always"` makes an offline attempt fail fast with a toast instead of
 * pausing forever. Refetches the jobsite list on success.
 */
export const useCreateJobsite = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation<JobsiteSummary, Error, { name: string }>({
    networkMode: "always",
    mutationFn: (input) => createJobsite(session!.access_token, input),
    onSuccess: (jobsite) => {
      queryClient.invalidateQueries({ queryKey: JOBSITES_QUERY_KEY });
      toast.success(`Created ${jobsite.name}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return {
    createJobsite: mutation.mutateAsync,
    isCreating: mutation.isPending,
  };
};
