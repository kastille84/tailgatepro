import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { enqueueMutation } from "../utils/db/outbox";
import { createReplayer } from "../utils/db/replayRegistry";
import {
  restoreProjectsQueries,
  snapshotProjectsQueries,
  upsertCachedProject,
} from "../utils/optimisticProjects";
import type { CreateProjectInput } from "../services/apiProjects";
import type { Project } from "../interfaces/project";

/**
 * Wraps the create-project mutation. Every write goes through the offline
 * outbox (`docs/offline-sync-design.md`) rather than calling the API
 * directly: `enqueueMutation` durably queues the change and, when online,
 * flushes it right away, so a connected user sees no added latency. A
 * synchronous, online failure (a validation error, say) still rejects here
 * and is discarded rather than retried — see `enqueueMutation`.
 *
 * Optimistically adds the new project to every cached `["projects", ...]`
 * list so it appears immediately, before the write is confirmed; rolled back
 * on a rejected mutation. The real values (`ownerCompanyId` in particular,
 * unknown client-side) arrive once the write syncs and the registered
 * replay handler invalidates the query.
 */
export const useCreateProject = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation<
    void,
    Error,
    CreateProjectInput,
    { previous: ReturnType<typeof snapshotProjectsQueries> }
  >({
    // TanStack Query's default `networkMode: "online"` would pause this
    // ENTIRE mutationFn — including the local, no-network outbox write
    // inside `enqueueMutation` — until its own onlineManager sees an
    // `online` event, silently doing nothing while offline. This app already
    // has its own, more accurate offline handling (the outbox's own
    // `navigator.onLine` check), so let it run immediately every time.
    networkMode: "always",
    mutationFn: (payload) =>
      enqueueMutation(
        {
          entity: "project",
          entityId: payload.id,
          op: "create",
          // The outbox stores an arbitrary JSON payload; CreateProjectInput
          // has no index signature, so it needs an explicit cast here.
          payload: payload as unknown as Record<string, unknown>,
        },
        session ? createReplayer(session.access_token) : undefined,
      ).then(() => undefined),
    onMutate: (payload) => {
      const previous = snapshotProjectsQueries(queryClient);
      const optimisticProject: Project = {
        id: payload.id,
        // Unknown until the write syncs — never read in the UI (interfaces/project.ts).
        ownerCompanyId: "",
        name: payload.name,
        // Only `linkProjectToGc` can set this, so a new project is never linked.
        gcCompanyId: null,
        gcNameCustom: payload.gcNameCustom ?? null,
        gcContactEmail: payload.gcContactEmail ?? null,
        status: "active",
        archivedAt: null,
        createdAt: new Date().toISOString(),
      };
      upsertCachedProject(queryClient, optimisticProject);
      return { previous };
    },
    onError: (error, _payload, context) => {
      if (context) restoreProjectsQueries(queryClient, context.previous);
      toast.error(error.message);
    },
  });

  return {
    createProject: (input: Omit<CreateProjectInput, "id">) =>
      mutation.mutateAsync({ id: crypto.randomUUID(), ...input }),
    isCreating: mutation.isPending,
  };
};
