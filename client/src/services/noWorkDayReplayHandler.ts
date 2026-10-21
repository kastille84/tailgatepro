import { registerReplayHandler } from "../utils/db/replayRegistry";
import { queryClient } from "../utils/queryClient";
import { createNoWorkDay, deleteNoWorkDay } from "./apiNoWorkDays";
import type { CreateNoWorkDayInput } from "./apiNoWorkDays";
import type { OutboxRow } from "../interfaces/sync";

/**
 * How the offline queue replays a "no_work_day" outbox row ("Mark day off",
 * docs/no-work-days-design.md): `create` -> POST, `delete` -> DELETE by the
 * row's `entityId`. The server answers a weekend / out-of-range date with a
 * no-op `{ ignored: true }` and an already-marked or already-removed day with
 * a plain success, so a replay never strands. Invalidates `["no-work-days"]`
 * after any successful flush so the sheet reconciles with the server.
 */
registerReplayHandler(
  "no_work_day",
  async (accessToken: string, row: OutboxRow): Promise<void> => {
    switch (row.op) {
      case "create":
        await createNoWorkDay(
          accessToken,
          row.payload as unknown as CreateNoWorkDayInput,
        );
        break;
      case "delete":
        await deleteNoWorkDay(accessToken, row.entityId);
        break;
    }

    queryClient.invalidateQueries({ queryKey: ["no-work-days"] });
  },
);
