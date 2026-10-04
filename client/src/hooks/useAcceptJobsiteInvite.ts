import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { acceptJobsiteInvite } from "../services/apiJobsites";
import { PROJECTS_QUERY_KEY } from "../utils/optimisticProjects";
import type { Project } from "../interfaces/project";

/**
 * Accepts a GC's jobsite invite as an already-registered subcontractor
 * (Phase 8d Case A). Online-only — the server validates the token and creates
 * the project — so `networkMode: "always"` fails fast with a toast offline.
 * Refetches the projects lists since the server creates a new project row.
 */
export const useAcceptJobsiteInvite = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation<Project, Error, string>({
    networkMode: "always",
    mutationFn: (token) => acceptJobsiteInvite(session!.access_token, token),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
      toast.success(`You've joined ${project.name}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return {
    acceptInvite: mutation.mutateAsync,
    isAccepting: mutation.isPending,
  };
};
