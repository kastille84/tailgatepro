import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../context/auth";
import { listProjects } from "../services/apiProjects";
import { cacheProjects, getCachedProjects } from "../utils/db/projectsCache";

/**
 * Loads the current company's projects. The app's first `useQuery`: the
 * `["projects"]` cache key prefix is what `useCreateProject` /
 * `useUpdateProject` / `useDeleteProject` invalidate after a write. Disabled
 * until a session exists so the query never runs without a bearer token.
 *
 * Every successful fetch is mirrored into the offline `projectsCache`
 * (`docs/offline-sync-design.md`); if the fetch fails — most commonly
 * because the device is offline — the cached list is returned instead so the
 * page still has something to show, and only propagates as an error when
 * nothing is cached either.
 *
 * Pass `includeArchived` to also load archived projects (the "Show archived"
 * toggle on the Projects page); it is part of the query key so the two views
 * are cached separately.
 */
export const useProjects = (includeArchived = false) => {
  const { session } = useAuth();

  const query = useQuery({
    queryKey: ["projects", { includeArchived }],
    // Without this, TanStack Query's default networkMode would pause this
    // ENTIRE queryFn — including its own try/catch fallback to the offline
    // cache below — until its onlineManager sees an `online` event, so a
    // user opening this page already offline would see it stuck loading
    // forever instead of falling back to the cache.
    networkMode: "always",
    queryFn: async () => {
      try {
        const projects = await listProjects(session!.access_token, {
          includeArchived,
        });
        await cacheProjects(projects);
        return projects;
      } catch (error) {
        const cached = await getCachedProjects(includeArchived);
        if (cached.length > 0) return cached;
        throw error;
      }
    },
    enabled: !!session,
  });

  return {
    projects: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
};
