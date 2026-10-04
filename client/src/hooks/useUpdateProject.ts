import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { enqueueMutation } from "../utils/db/outbox";
import { createReplayer } from "../utils/db/replayRegistry";
import {
  applyProjectPatch,
  findCachedProject,
  restoreProjectsQueries,
  snapshotProjectsQueries,
  upsertCachedProject,
} from "../utils/optimisticProjects";
import type { UpdateProjectPatch } from "../services/apiProjects";

interface UpdateProjectVariables {
  id: string;
  patch: UpdateProjectPatch;
}

/**
 * Wraps the patch-project mutation. Same offline-queue shape as
 * `useCreateProject`: enqueues through the outbox rather than calling the
 * API directly, optimistically merges the patch onto the cached project (if
 * one is cached), and rolls that back if the mutation is rejected outright.
 */
export const useUpdateProject = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation<
    void,
    Error,
    UpdateProjectVariables,
    { previous: ReturnType<typeof snapshotProjectsQueries> }
  >({
    // See useCreateProject.ts: without this, TanStack Query's default
    // networkMode pauses mutationFn (outbox write included) until its own
    // onlineManager sees an `online` event, instead of running immediately
    // and letting the outbox's own navigator.onLine check decide.
    networkMode: "always",
    mutationFn: ({ id, patch }) =>
      enqueueMutation(
        {
          entity: "project",
          entityId: id,
          op: "update",
          // UpdateProjectPatch has no index signature, hence the cast.
          payload: patch as unknown as Record<string, unknown>,
        },
        session ? createReplayer(session.access_token) : undefined,
      ).then(() => undefined),
    onMutate: ({ id, patch }) => {
      const previous = snapshotProjectsQueries(queryClient);
      const existing = findCachedProject(queryClient, id);
      if (existing) {
        upsertCachedProject(queryClient, applyProjectPatch(existing, patch));
      }
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context) restoreProjectsQueries(queryClient, context.previous);
      toast.error(error.message);
    },
  });

  return {
    updateProject: mutation.mutateAsync,
    isUpdating: mutation.isPending,
  };
};
