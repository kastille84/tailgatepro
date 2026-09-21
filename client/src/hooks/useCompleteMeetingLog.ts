import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { enqueueMutation } from "../utils/db/outbox";
import { createReplayer } from "../utils/db/replayRegistry";

export interface CompleteMeetingLogInput {
  meetingId: string;
  signatureIds: string[];
}

/**
 * Wraps the complete-meeting mutation. `entityId` reuses the meeting log's
 * own id (no separate completion record — see `interfaces/sync.ts`), which
 * chains this row behind the meeting log's create and any crew-photo update
 * via the outbox's ordinary same-entityId ordering. `dependsOnEntityIds` is
 * every collected signature's id — completion can't be replayed until every
 * signature (and its blob) has actually synced, since the server requires
 * >=1 signature to exist and a signature depending on a not-yet-landed
 * meeting log would itself still be queued. See `utils/db/outbox.ts` and
 * `docs/meeting-flow-design.md`.
 *
 * The payload carries `heldAt`, the moment the completion is enqueued — right
 * after the foreman finishes collecting signatures — rather than when the row
 * eventually syncs. That's what lets a meeting completed offline all day and
 * synced the next morning still be recorded (and filed on the PDF, its
 * filename, and the GC dashboard) under the day it actually happened. A save
 * resumed after an interruption stamps the resume time, not the first tap.
 */
export const useCompleteMeetingLog = () => {
  const { session } = useAuth();

  const mutation = useMutation<void, Error, CompleteMeetingLogInput>({
    networkMode: "always",
    mutationFn: ({ meetingId, signatureIds }) =>
      enqueueMutation(
        {
          entity: "meeting_completion",
          entityId: meetingId,
          op: "complete",
          payload: { heldAt: new Date().toISOString() },
          dependsOnEntityIds: signatureIds,
        },
        session ? createReplayer(session.access_token) : undefined,
      ).then(() => undefined),
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return {
    completeMeetingLog: (input: CompleteMeetingLogInput) =>
      mutation.mutateAsync(input),
    isCompleting: mutation.isPending,
  };
};
