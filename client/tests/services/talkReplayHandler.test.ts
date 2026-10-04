import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/services/apiTalks");

import * as apiTalks from "../../src/services/apiTalks";
import { queryClient } from "../../src/utils/queryClient";
import { createReplayer } from "../../src/utils/db/replayRegistry";
import type { OutboxRow } from "../../src/interfaces/sync";

// Registers the "talk" handler as a side effect — matches how it's actually
// wired up (a side-effect import at the top of App.tsx).
import "../../src/services/talkReplayHandler";

const baseRow: OutboxRow = {
  id: "row-1",
  entity: "talk",
  entityId: "talk-1",
  op: "create",
  payload: {},
  status: "pending",
  attempts: 0,
  lastError: null,
  createdAt: "2026-09-13T00:00:00.000Z",
  syncedAt: null,
};

describe("talkReplayHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dispatches a create row to apiTalks.createTalk with its payload", async () => {
    vi.mocked(apiTalks.createTalk).mockResolvedValue({} as never);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    await createReplayer("token-123")({
      ...baseRow,
      op: "create",
      payload: { id: "talk-1", title: "Ladder Safety" },
    });

    expect(apiTalks.createTalk).toHaveBeenCalledWith("token-123", {
      id: "talk-1",
      title: "Ladder Safety",
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["talks"] });
  });

  it("dispatches an update row to apiTalks.updateTalk with the entityId and payload", async () => {
    vi.mocked(apiTalks.updateTalk).mockResolvedValue({} as never);

    await createReplayer("token-123")({
      ...baseRow,
      op: "update",
      payload: { title: "renamed" },
    });

    expect(apiTalks.updateTalk).toHaveBeenCalledWith("token-123", "talk-1", {
      title: "renamed",
    });
  });

  it("dispatches a delete row to apiTalks.deleteTalk with the entityId", async () => {
    vi.mocked(apiTalks.deleteTalk).mockResolvedValue({ id: "talk-1" });

    await createReplayer("token-123")({ ...baseRow, op: "delete" });

    expect(apiTalks.deleteTalk).toHaveBeenCalledWith("token-123", "talk-1");
  });

  it("propagates the API error and does not invalidate on failure", async () => {
    vi.mocked(apiTalks.createTalk).mockRejectedValue(
      new Error("Title is required"),
    );
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    await expect(
      createReplayer("token-123")({
        ...baseRow,
        op: "create",
        payload: { id: "talk-1", title: "" },
      }),
    ).rejects.toThrow("Title is required");

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
