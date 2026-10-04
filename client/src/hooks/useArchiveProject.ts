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

interface ArchiveProjectVariables {
  id: string;
  /** `true` archives the project, `false` restores it. */
  archived: boolean;
}

/**
 * Wraps archive / restore, which ride on `PATCH /api/projects/:id` via the
 * `archived` flag — kept separate from `useUpdateProject` so it can own its
 * own success toast (archived vs restored). Same offline-queue shape as the
 * other Projects mutations: enqueues through the outbox, optimistically
 * moves the cached project between the default and "show archived" views,
 * and rolls that back if the mutation is rejected outright.
 */
export const useArchiveProject = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation<
    void,
    Error,
    ArchiveProjectVariables,
    { previous: ReturnType<typeof snapshotProjectsQueries> }
  >({
    // See useCreateProject.ts: without this, TanStack Query's default
    // networkMode pauses mutationFn (outbox write included) until its own
    // onlineManager sees an `online` event, instead of running immediately
    // and letting the outbox's own navigator.onLine check decide.
    networkMode: "always",
    mutationFn: ({ id, archived }) =>
      enqueueMutation(
        {
          entity: "project",
          entityId: id,
          op: "archive",
          payload: { archived },
        },
        session ? createReplayer(session.access_token) : undefined,
      ).then(() => undefined),
    onMutate: ({ id, archived }) => {
      const previous = snapshotProjectsQueries(queryClient);
      const existing = findCachedProject(queryClient, id);
      if (existing) {
        upsertCachedProject(
          queryClient,
          applyProjectPatch(existing, { archived }),
        );
      }
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context) restoreProjectsQueries(queryClient, context.previous);
      toast.error(error.message);
    },
    onSuccess: (_data, { archived }) => {
      toast.success(archived ? "Project archived" : "Project restored");
    },
  });

  return {
    archiveProject: mutation.mutateAsync,
    isArchiving: mutation.isPending,
  };
};
