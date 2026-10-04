import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { enqueueMutation } from "../utils/db/outbox";
import { createReplayer } from "../utils/db/replayRegistry";
import {
  removeCachedProject,
  restoreProjectsQueries,
  snapshotProjectsQueries,
} from "../utils/optimisticProjects";

/**
 * Wraps the hard-delete mutation. Same offline-queue shape as the other
 * Projects mutations: enqueues through the outbox, optimistically removes
 * the project from every cached list, and rolls that back if the mutation is
 * rejected outright — including the 409 "archive it instead" guard, which
 * (per `docs/offline-sync-design.md`) surfaces immediately rather than
 * silently queuing a delete that can never succeed.
 */
export const useDeleteProject = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation<
    void,
    Error,
    string,
    { previous: ReturnType<typeof snapshotProjectsQueries> }
  >({
    // See useCreateProject.ts: without this, TanStack Query's default
    // networkMode pauses mutationFn (outbox write included) until its own
    // onlineManager sees an `online` event, instead of running immediately
    // and letting the outbox's own navigator.onLine check decide.
    networkMode: "always",
    mutationFn: (id) =>
      enqueueMutation(
        { entity: "project", entityId: id, op: "delete", payload: {} },
        session ? createReplayer(session.access_token) : undefined,
      ).then(() => undefined),
    onMutate: (id) => {
      const previous = snapshotProjectsQueries(queryClient);
      removeCachedProject(queryClient, id);
      return { previous };
    },
    onError: (error, _id, context) => {
      if (context) restoreProjectsQueries(queryClient, context.previous);
      toast.error(error.message);
    },
    onSuccess: () => {
      toast.success("Project deleted");
    },
  });

  return {
    deleteProject: mutation.mutateAsync,
    isDeleting: mutation.isPending,
  };
};
