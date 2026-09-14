import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { enqueueMutation } from "../utils/db/outbox";
import { createReplayer } from "../utils/db/replayRegistry";
import {
  removeCachedTalk,
  restoreTalksQueries,
  snapshotTalksQueries,
} from "../utils/optimisticTalks";

/**
 * Wraps the hard-delete mutation. Same offline-queue shape as
 * `useDeleteProject`: enqueues through the outbox, optimistically removes
 * the talk from the cached list, and rolls that back if the mutation is
 * rejected outright — including the 409 in-use guard, which surfaces
 * immediately rather than silently queuing a delete that can never succeed.
 */
export const useDeleteTalk = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation<
    void,
    Error,
    string,
    { previous: ReturnType<typeof snapshotTalksQueries> }
  >({
    // See useCreateProject.ts.
    networkMode: "always",
    mutationFn: (id) =>
      enqueueMutation(
        { entity: "talk", entityId: id, op: "delete", payload: {} },
        session ? createReplayer(session.access_token) : undefined,
      ).then(() => undefined),
    onMutate: (id) => {
      const previous = snapshotTalksQueries(queryClient);
      removeCachedTalk(queryClient, id);
      return { previous };
    },
    onError: (error, _id, context) => {
      if (context) restoreTalksQueries(queryClient, context.previous);
      toast.error(error.message);
    },
    onSuccess: () => {
      toast.success("Talk deleted");
    },
  });

  return {
    deleteTalk: mutation.mutateAsync,
    isDeleting: mutation.isPending,
  };
};
