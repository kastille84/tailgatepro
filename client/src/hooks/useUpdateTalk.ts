import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { enqueueMutation } from "../utils/db/outbox";
import { createReplayer } from "../utils/db/replayRegistry";
import {
  applyTalkPatch,
  findCachedTalk,
  restoreTalksQueries,
  snapshotTalksQueries,
  upsertCachedTalk,
} from "../utils/optimisticTalks";
import type { UpdateTalkInput } from "../services/apiTalks";

interface UpdateTalkVariables {
  id: string;
  input: UpdateTalkInput;
}

/**
 * Wraps the update-talk mutation. Same offline-queue shape as
 * `useUpdateProject`: enqueues through the outbox rather than calling the
 * API directly, optimistically full-replaces the cached talk's editable
 * fields (if one is cached), and rolls that back if the mutation is
 * rejected outright — including the server's 409 once the talk has been
 * used in a logged safety talk.
 */
export const useUpdateTalk = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation<
    void,
    Error,
    UpdateTalkVariables,
    { previous: ReturnType<typeof snapshotTalksQueries> }
  >({
    // See useCreateProject.ts.
    networkMode: "always",
    mutationFn: ({ id, input }) =>
      enqueueMutation(
        {
          entity: "talk",
          entityId: id,
          op: "update",
          // UpdateTalkInput has no index signature, hence the cast.
          payload: input as unknown as Record<string, unknown>,
        },
        session ? createReplayer(session.access_token) : undefined,
      ).then(() => undefined),
    onMutate: ({ id, input }) => {
      const previous = snapshotTalksQueries(queryClient);
      const existing = findCachedTalk(queryClient, id);
      if (existing) {
        upsertCachedTalk(queryClient, applyTalkPatch(existing, input));
      }
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context) restoreTalksQueries(queryClient, context.previous);
      toast.error(error.message);
    },
  });

  return {
    updateTalk: mutation.mutateAsync,
    isUpdating: mutation.isPending,
  };
};
