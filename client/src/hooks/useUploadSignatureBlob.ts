import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { storeMediaBlob } from "../utils/db/mediaBlobs";
import { enqueueMutation } from "../utils/db/outbox";
import { createReplayer } from "../utils/db/replayRegistry";

export interface UploadSignatureBlobInput {
  meetingId: string;
  signatureId: string;
  blob: Blob;
}

/**
 * Wraps the signature-blob upload mutation — the captured PNG from the
 * signature pad. Mirrors `useUploadCrewPhoto`: the blob is stored locally
 * first, then an outbox row referencing it is enqueued with `entity:
 * "signature"` and the *same* `entityId` as the signature's own create row,
 * so the outbox's ordinary same-entityId ordering already blocks this
 * upload from being attempted before its record exists — no
 * `dependsOnEntityId` needed here (unlike the signature create itself,
 * which depends on its parent meeting log). See
 * `docs/meeting-flow-design.md`.
 */
export const useUploadSignatureBlob = () => {
  const { session } = useAuth();

  const mutation = useMutation<void, Error, UploadSignatureBlobInput>({
    networkMode: "always",
    mutationFn: async ({ meetingId, signatureId, blob }) => {
      const mediaBlobId = await storeMediaBlob(blob);
      await enqueueMutation(
        {
          entity: "signature",
          entityId: signatureId,
          op: "update",
          payload: { meetingId, mediaBlobId },
        },
        session ? createReplayer(session.access_token) : undefined,
      );
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return {
    uploadSignatureBlob: (input: UploadSignatureBlobInput) =>
      mutation.mutateAsync(input),
    isUploading: mutation.isPending,
  };
};
