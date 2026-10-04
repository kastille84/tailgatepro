import type { QueryClient } from "@tanstack/react-query";

import type { Project } from "../interfaces/project";
import type { UpdateProjectPatch } from "../services/apiProjects";

/** Matches every `useProjects` cache entry — both the default
 *  (`includeArchived: false`) and "show archived" variants. */
export const PROJECTS_QUERY_KEY = ["projects"] as const;

/** A `["projects", { includeArchived }]` query key, as `useProjects` builds
 *  it. `setQueriesData`'s updater only gets the old data, not the query
 *  itself, so callers that need to know which `includeArchived` variant
 *  they're touching read it straight off the key. */
const includesArchived = (queryKey: readonly unknown[]): boolean => {
  const params = queryKey[1] as { includeArchived?: boolean } | undefined;
  return Boolean(params?.includeArchived);
};

/** Snapshot every cached projects list, to hand to `restoreProjectsQueries`
 *  if a queued write is rejected outright (see `docs/offline-sync-design.md`). */
export const snapshotProjectsQueries = (queryClient: QueryClient) =>
  queryClient.getQueriesData<Project[]>({ queryKey: PROJECTS_QUERY_KEY });

/** Rolls back to a snapshot taken by `snapshotProjectsQueries`. */
export const restoreProjectsQueries = (
  queryClient: QueryClient,
  snapshot: ReturnType<typeof snapshotProjectsQueries>,
): void => {
  snapshot.forEach(([key, data]) => queryClient.setQueryData(key, data));
};

/** The first cached copy of a project, from whichever view has it — used to
 *  merge a patch onto a full `Project` for an optimistic update. */
export const findCachedProject = (
  queryClient: QueryClient,
  id: string,
): Project | undefined => {
  for (const [, data] of snapshotProjectsQueries(queryClient)) {
    const found = data?.find((project) => project.id === id);
    if (found) return found;
  }
  return undefined;
};

/** Merges an `UpdateProjectPatch` onto a full `Project`, the way the server's
 *  `PATCH /api/projects/:id` applies it — only the given fields change, and
 *  `archived` maps onto `archivedAt` (a timestamp when archiving, `null` when
 *  restoring). Used by `useUpdateProject`/`useArchiveProject` to build an
 *  optimistic entry from a cached project plus the patch being sent. */
export const applyProjectPatch = (
  existing: Project,
  patch: UpdateProjectPatch,
): Project => ({
  ...existing,
  ...(patch.name !== undefined && { name: patch.name }),
  ...(patch.status !== undefined && { status: patch.status }),
  ...(patch.gcNameCustom !== undefined && {
    gcNameCustom: patch.gcNameCustom,
  }),
  ...(patch.gcContactEmail !== undefined && {
    gcContactEmail: patch.gcContactEmail,
  }),
  ...(patch.archived !== undefined && {
    archivedAt: patch.archived ? new Date().toISOString() : null,
  }),
});

/** Optimistically reflects a create/update/archive/restore in every cached
 *  list: added or replaced in the "show archived" view, and included in the
 *  default view only while `archivedAt` is null. */
export const upsertCachedProject = (
  queryClient: QueryClient,
  project: Project,
): void => {
  snapshotProjectsQueries(queryClient).forEach(([key, current]) => {
    if (!current) return;

    if (!includesArchived(key) && project.archivedAt !== null) {
      queryClient.setQueryData(
        key,
        current.filter((p) => p.id !== project.id),
      );
      return;
    }

    const index = current.findIndex((p) => p.id === project.id);
    queryClient.setQueryData(
      key,
      index === -1
        ? [...current, project]
        : current.map((p, i) => (i === index ? project : p)),
    );
  });
};

/** Optimistically removes a deleted project from every cached list. */
export const removeCachedProject = (
  queryClient: QueryClient,
  projectId: string,
): void => {
  snapshotProjectsQueries(queryClient).forEach(([key, current]) => {
    if (!current) return;
    queryClient.setQueryData(
      key,
      current.filter((p) => p.id !== projectId),
    );
  });
};
