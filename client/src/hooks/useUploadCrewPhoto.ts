import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { storeMediaBlob } from "../utils/db/mediaBlobs";
import { enqueueMutation } from "../utils/db/outbox";
import { createReplayer } from "../utils/db/replayRegistry";

export interface UploadCrewPhotoInput {
  meetingId: string;
  blob: Blob;
}

/**
 * Wraps the crew-photo upload mutation. The captured blob is stored locally
 * first (`storeMediaBlob`, always — regardless of online status), then an
 * outbox row referencing it by id is enqueued; `crew_photo`'s `entityId` is
 * the parent meeting log's own id (there's no separate crew-photo record —
 * see `interfaces/sync.ts`), which is what already chains this upload behind
 * its meeting log's create via the outbox's ordinary same-entityId ordering,
 * with no `dependsOnEntityId` needed. See `docs/meeting-flow-design.md`.
 */
export const useUploadCrewPhoto = () => {
  const { session } = useAuth();

  const mutation = useMutation<void, Error, UploadCrewPhotoInput>({
    networkMode: "always",
    mutationFn: async ({ meetingId, blob }) => {
      const mediaBlobId = await storeMediaBlob(blob);
      await enqueueMutation(
        {
          entity: "crew_photo",
          entityId: meetingId,
          op: "update",
          payload: { mediaBlobId },
        },
        session ? createReplayer(session.access_token) : undefined,
      );
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return {
    uploadCrewPhoto: (input: UploadCrewPhotoInput) =>
      mutation.mutateAsync(input),
    isUploading: mutation.isPending,
  };
};
