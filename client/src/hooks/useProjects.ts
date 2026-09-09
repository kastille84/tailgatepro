import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../context/auth";
import { listProjects } from "../services/apiProjects";

/**
 * Loads the current company's projects. The app's first `useQuery`: the
 * `["projects"]` cache key is what `useCreateProject` / `useUpdateProject`
 * invalidate after a write. Disabled until a session exists so the query never
 * runs without a bearer token.
 */
export const useProjects = () => {
  const { session } = useAuth();

  const query = useQuery({
    queryKey: ["projects"],
    queryFn: () => listProjects(session!.access_token),
    enabled: !!session,
  });

  return {
    projects: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
};
