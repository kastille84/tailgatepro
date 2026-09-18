import { registerReplayHandler } from "../utils/db/replayRegistry";
import { deleteMediaBlob, getMediaBlob } from "../utils/db/mediaBlobs";
import {
  completeMeeting,
  createMeetingLog,
  uploadCrewPhoto,
} from "./apiMeetingLogs";
import type { CreateMeetingLogInput } from "./apiMeetingLogs";
import type { OutboxRow } from "../interfaces/sync";

/**
 * How the offline queue replays a "meeting_log" outbox row. No cache to
 * invalidate here (unlike `talkReplayHandler.ts`) — there's no
 * `useMeetingLogs` query yet for any page to read from; that's a 4f/4g
 * concern. See `docs/meeting-flow-design.md`.
 */
registerReplayHandler(
  "meeting_log",
  async (accessToken: string, row: OutboxRow): Promise<void> => {
    switch (row.op) {
      case "create":
        await createMeetingLog(
          accessToken,
          row.payload as unknown as CreateMeetingLogInput,
        );
        break;
    }
  },
);

/**
 * How the offline queue replays a "crew_photo" outbox row — the one
 * operation in this file whose request body isn't JSON. The row's `entityId`
 * is the parent meeting log's own id (there's no separate crew-photo
 * record), and `payload.mediaBlobId` points at the captured blob stored
 * locally by `storeMediaBlob`. The blob is only deleted once the upload
 * actually succeeds.
 */
registerReplayHandler(
  "crew_photo",
  async (accessToken: string, row: OutboxRow): Promise<void> => {
    const { mediaBlobId } = row.payload as unknown as { mediaBlobId: string };
    const stored = await getMediaBlob(mediaBlobId);
    if (!stored) {
      throw new Error("The captured photo is no longer available locally.");
    }

    await uploadCrewPhoto(accessToken, row.entityId, stored.blob);
    await deleteMediaBlob(mediaBlobId);
  },
);

/**
 * How the offline queue replays a "meeting_completion" outbox row — like
 * `crew_photo`, there's no separate record of its own, so `entityId` is the
 * meeting log's own id. Only one op is possible, so this calls
 * `completeMeeting` directly rather than switching on `row.op`.
 */
registerReplayHandler(
  "meeting_completion",
  async (accessToken: string, row: OutboxRow): Promise<void> => {
    await completeMeeting(accessToken, row.entityId);
  },
);
