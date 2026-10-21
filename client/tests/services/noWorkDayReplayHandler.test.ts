import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/services/apiNoWorkDays");

import * as apiNoWorkDays from "../../src/services/apiNoWorkDays";
import { queryClient } from "../../src/utils/queryClient";
import { createReplayer } from "../../src/utils/db/replayRegistry";
import type { OutboxRow } from "../../src/interfaces/sync";

// Registers the "no_work_day" handler as a side effect, as App.tsx does.
import "../../src/services/noWorkDayReplayHandler";

const baseRow: OutboxRow = {
  id: "row-1",
  entity: "no_work_day",
  entityId: "nwd-1",
  op: "create",
  payload: {},
  status: "pending",
  attempts: 0,
  lastError: null,
  createdAt: "2026-11-20T00:00:00.000Z",
  syncedAt: null,
};

describe("noWorkDayReplayHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dispatches a create row to apiNoWorkDays.createNoWorkDay and invalidates the list", async () => {
    vi.mocked(apiNoWorkDays.createNoWorkDay).mockResolvedValue({ ignored: true });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const payload = {
      id: "nwd-1",
      projectId: "p1",
      offDate: "2026-11-26",
      reason: "holiday",
    };

    await createReplayer("token-123")({ ...baseRow, op: "create", payload });

    expect(apiNoWorkDays.createNoWorkDay).toHaveBeenCalledWith("token-123", payload);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["no-work-days"] });
  });

  it("dispatches a delete row to apiNoWorkDays.deleteNoWorkDay with the entityId", async () => {
    vi.mocked(apiNoWorkDays.deleteNoWorkDay).mockResolvedValue({ id: "nwd-1" });

    await createReplayer("token-123")({ ...baseRow, op: "delete" });

    expect(apiNoWorkDays.deleteNoWorkDay).toHaveBeenCalledWith("token-123", "nwd-1");
  });

  it("propagates the API error and does not invalidate on failure", async () => {
    vi.mocked(apiNoWorkDays.createNoWorkDay).mockRejectedValue(new Error("Project not found"));
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    await expect(
      createReplayer("token-123")({ ...baseRow, op: "create", payload: {} }),
    ).rejects.toThrow("Project not found");

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
