import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { setMyJobsiteCadence } from "../services/apiJobsites";
import { JOBSITE_MEMBERSHIPS_QUERY_KEY } from "./useJobsiteMemberships";
import type { MeetingCadence, MyCadenceResult } from "../interfaces/jobsite";

interface SetMyCadenceVariables {
  jobsiteId: string;
  /** `null` clears the override so the GC's default applies again. */
  cadence: MeetingCadence | null;
}

/**
 * Tightens (or clears) a subcontractor company's own meeting cadence on a
 * jobsite (Phase 11f). Online-only like `useUpdateJobsite`. Refetches the
 * memberships on success.
 */
export const useSetMyCadence = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation<MyCadenceResult, Error, SetMyCadenceVariables>({
    networkMode: "always",
    mutationFn: ({ jobsiteId, cadence }) =>
      setMyJobsiteCadence(session!.access_token, jobsiteId, cadence),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: JOBSITE_MEMBERSHIPS_QUERY_KEY });
      toast.success("Meeting cadence updated");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return {
    setMyCadence: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
};
