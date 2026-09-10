import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../context/auth";
import { listProjects } from "../services/apiProjects";

/**
 * Loads the current company's projects. The app's first `useQuery`: the
 * `["projects"]` cache key prefix is what `useCreateProject` /
 * `useUpdateProject` / `useDeleteProject` invalidate after a write. Disabled
 * until a session exists so the query never runs without a bearer token.
 *
 * Pass `includeArchived` to also load archived projects (the "Show archived"
 * toggle on the Projects page); it is part of the query key so the two views
 * are cached separately.
 */
export const useProjects = (includeArchived = false) => {
  const { session } = useAuth();

  const query = useQuery({
    queryKey: ["projects", { includeArchived }],
    queryFn: () =>
      listProjects(session!.access_token, { includeArchived }),
    enabled: !!session,
  });

  return {
    projects: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
};
