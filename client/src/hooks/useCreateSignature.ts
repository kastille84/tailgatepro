import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { enqueueMutation } from "../utils/db/outbox";
import { createReplayer } from "../utils/db/replayRegistry";
import type { CreateSignatureInput } from "../services/apiSignatures";

type CreateSignatureVariables = { meetingId: string } & CreateSignatureInput;

/**
 * Wraps the create-signature mutation. `dependsOnEntityId` is set to the
 * parent meeting log's id — a signature can't land server-side before its
 * meeting does, and (unlike a crew photo, which reuses its meeting's own
 * `entityId`) each signature under one meeting needs its own distinct
 * `entityId` so one worker's rejected signature can't poison another's. See
 * `utils/db/outbox.ts` and `docs/meeting-flow-design.md`. Otherwise mirrors
 * `useCreateMeetingLog` — no optimistic cache update, returns the
 * client-generated id synchronously.
 */
export const useCreateSignature = () => {
  const { session } = useAuth();

  const mutation = useMutation<void, Error, CreateSignatureVariables>({
    networkMode: "always",
    mutationFn: ({ meetingId, ...input }) =>
      enqueueMutation(
        {
          entity: "signature",
          entityId: input.id,
          op: "create",
          payload: { meetingId, ...input } as unknown as Record<
            string,
            unknown
          >,
          dependsOnEntityId: meetingId,
        },
        session ? createReplayer(session.access_token) : undefined,
      ).then(() => undefined),
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return {
    createSignature: async (
      input: { meetingId: string } & Omit<CreateSignatureInput, "id">,
    ): Promise<string> => {
      const id = crypto.randomUUID();
      await mutation.mutateAsync({ id, ...input });
      return id;
    },
    isCreating: mutation.isPending,
  };
};
