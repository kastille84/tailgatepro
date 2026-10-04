import { registerReplayHandler } from "../utils/db/replayRegistry";
import { deleteMediaBlob, getMediaBlob } from "../utils/db/mediaBlobs";
import { createSignature, uploadSignatureBlob } from "./apiSignatures";
import type { CreateSignatureInput } from "./apiSignatures";
import type { OutboxRow } from "../interfaces/sync";

/**
 * How the offline queue replays a "signature" outbox row. `create` dispatches
 * a JSON body like every other handler; `update` is the blob-upload case —
 * the one place this handler's request body isn't JSON — reading the
 * captured PNG back out of `mediaBlobs` by the id carried in `payload` and
 * PUTing it raw. No cache to invalidate — see `meetingLogReplayHandler.ts`.
 * See `docs/meeting-flow-design.md`.
 */
registerReplayHandler(
  "signature",
  async (accessToken: string, row: OutboxRow): Promise<void> => {
    switch (row.op) {
      case "create": {
        const { meetingId, ...input } = row.payload as unknown as CreateSignatureInput & {
          meetingId: string;
        };
        await createSignature(accessToken, meetingId, input);
        break;
      }
      case "update": {
        const { meetingId, mediaBlobId } = row.payload as unknown as {
          meetingId: string;
          mediaBlobId: string;
        };
        const stored = await getMediaBlob(mediaBlobId);
        if (!stored) {
          throw new Error(
            "The captured signature is no longer available locally.",
          );
        }

        await uploadSignatureBlob(
          accessToken,
          meetingId,
          row.entityId,
          stored.blob,
        );
        await deleteMediaBlob(mediaBlobId);
        break;
      }
    }
  },
);
