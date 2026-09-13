import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createReplayer,
  registerReplayHandler,
  resetReplayHandlers,
} from "../../../src/utils/db/replayRegistry";
import type { OutboxRow } from "../../../src/interfaces/sync";

const row: OutboxRow = {
  id: "row-1",
  entity: "project",
  entityId: "project-1",
  op: "create",
  payload: { id: "project-1" },
  status: "pending",
  attempts: 0,
  lastError: null,
  createdAt: "2026-09-13T00:00:00.000Z",
  syncedAt: null,
};

afterEach(() => {
  resetReplayHandlers();
});

describe("createReplayer", () => {
  it("dispatches a row to the handler registered for its entity, with the given token", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    registerReplayHandler("project", handler);

    await createReplayer("token-123")(row);

    expect(handler).toHaveBeenCalledWith("token-123", row);
  });

  it("throws when no handler is registered for the row's entity", async () => {
    await expect(createReplayer("token-123")(row)).rejects.toThrow(
      /No replay handler registered for entity "project"/,
    );
  });

  it("propagates the handler's rejection", async () => {
    registerReplayHandler(
      "project",
      vi.fn().mockRejectedValue(new Error("boom")),
    );

    await expect(createReplayer("token-123")(row)).rejects.toThrow("boom");
  });
});
