import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import {
  linkProjectToGc,
  unlinkProjectFromGc,
} from "../services/apiProjects";
import { PROJECTS_QUERY_KEY } from "../utils/optimisticProjects";
import type { Project } from "../interfaces/project";

interface LinkProjectVariables {
  id: string;
  joinCode: string;
}

/**
 * Wraps linking a project to a GC by join code, and unlinking it again.
 * Unlike the other project writes this deliberately does NOT go through the
 * offline outbox: the server validates the code against a live GC company, so
 * there is nothing sensible to queue — the UI is online-only and shows an
 * offline note instead. `networkMode: "always"` keeps a dropped connection
 * from leaving the mutation silently paused (a spinner forever); the request
 * fails fast through `fetchWithTimeout` and toasts instead.
 *
 * On success it refetches the projects lists, since the server is the source
 * of truth for `gcCompanyId` / `gcNameCustom` after a link.
 */
export const useLinkProjectToGc = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const refreshProjects = () =>
    queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });

  const linkMutation = useMutation<Project, Error, LinkProjectVariables>({
    networkMode: "always",
    mutationFn: ({ id, joinCode }) =>
      linkProjectToGc(session!.access_token, id, joinCode),
    onSuccess: (project) => {
      refreshProjects();
      toast.success(`Linked to ${project.gcNameCustom}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const unlinkMutation = useMutation<Project, Error, string>({
    networkMode: "always",
    mutationFn: (id) => unlinkProjectFromGc(session!.access_token, id),
    onSuccess: () => {
      refreshProjects();
      toast.success("Unlinked from the general contractor");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return {
    linkProject: linkMutation.mutateAsync,
    unlinkProject: unlinkMutation.mutateAsync,
    isLinking: linkMutation.isPending,
    isUnlinking: unlinkMutation.isPending,
  };
};
