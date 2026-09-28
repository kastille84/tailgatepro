import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { acceptJobsiteJoinLink } from "../services/apiJobsites";
import { PROJECTS_QUERY_KEY } from "../utils/optimisticProjects";
import type { JobsiteJoinAcceptResult } from "../interfaces/jobsite";

/**
 * Self-admits the caller's own subcontractor company onto a jobsite via a
 * scanned QR/join link (Phase 9e) — no GC approval, no email check. Online-
 * only, same as `useAcceptJobsiteInvite`, since the server validates the
 * token and (on a first join) creates the project. Re-scanning a link the
 * caller's company already accepted resolves with `alreadyMember: true`
 * instead of throwing — a friendlier toast, not an error.
 */
export const useAcceptJoinLink = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation<JobsiteJoinAcceptResult, Error, string>({
    networkMode: "always",
    mutationFn: (token) => acceptJobsiteJoinLink(session!.access_token, token),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
      toast.success(
        result.alreadyMember
          ? "You're already on this job site"
          : `You've joined ${result.name}`,
      );
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return {
    acceptJoinLink: mutation.mutateAsync,
    isAccepting: mutation.isPending,
  };
};
