import { registerReplayHandler } from "../utils/db/replayRegistry";
import { queryClient } from "../utils/queryClient";
import { createProject, deleteProject, updateProject } from "./apiProjects";
import type { CreateProjectInput, UpdateProjectPatch } from "./apiProjects";
import type { OutboxRow } from "../interfaces/sync";

/**
 * How the offline queue replays a "project" outbox row: dispatches each `op`
 * to the same `apiProjects` calls a direct, online mutation always used, then
 * invalidates `["projects"]` so every view reconciles with the server's
 * response. Runs after ANY successful flush — the mutation's own immediate
 * attempt, the `online` event, a manual retry, or the backstop poll — so the
 * cache stays correct no matter what triggered the sync. See
 * `docs/offline-sync-design.md`.
 */
registerReplayHandler(
  "project",
  async (accessToken: string, row: OutboxRow): Promise<void> => {
    switch (row.op) {
      case "create":
        await createProject(
          accessToken,
          row.payload as unknown as CreateProjectInput,
        );
        break;
      case "update":
      case "archive":
        await updateProject(
          accessToken,
          row.entityId,
          row.payload as unknown as UpdateProjectPatch,
        );
        break;
      case "delete":
        await deleteProject(accessToken, row.entityId);
        break;
    }

    queryClient.invalidateQueries({ queryKey: ["projects"] });
  },
);
