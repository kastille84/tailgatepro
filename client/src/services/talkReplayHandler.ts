import { registerReplayHandler } from "../utils/db/replayRegistry";
import { queryClient } from "../utils/queryClient";
import { createTalk, deleteTalk, updateTalk } from "./apiTalks";
import type { CreateTalkInput, UpdateTalkInput } from "./apiTalks";
import type { OutboxRow } from "../interfaces/sync";

/**
 * How the offline queue replays a "talk" outbox row: dispatches each `op` to
 * the same `apiTalks` calls a direct, online mutation always used, then
 * invalidates `["talks"]` so the list reconciles with the server's response
 * (in particular, the server-composed `content` Markdown, which an
 * optimistic cache entry can't reproduce). No `"archive"` case — Talks has
 * no archive concept. See `docs/offline-sync-design.md`.
 */
registerReplayHandler(
  "talk",
  async (accessToken: string, row: OutboxRow): Promise<void> => {
    switch (row.op) {
      case "create":
        await createTalk(
          accessToken,
          row.payload as unknown as CreateTalkInput,
        );
        break;
      case "update":
        await updateTalk(
          accessToken,
          row.entityId,
          row.payload as unknown as UpdateTalkInput,
        );
        break;
      case "delete":
        await deleteTalk(accessToken, row.entityId);
        break;
    }

    queryClient.invalidateQueries({ queryKey: ["talks"] });
  },
);
