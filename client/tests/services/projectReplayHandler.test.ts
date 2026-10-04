import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/services/apiProjects");

import * as apiProjects from "../../src/services/apiProjects";
import { queryClient } from "../../src/utils/queryClient";
import { createReplayer } from "../../src/utils/db/replayRegistry";
import type { OutboxRow } from "../../src/interfaces/sync";

// Registers the "project" handler as a side effect — matches how it's
// actually wired up (a side-effect import at the top of App.tsx).
import "../../src/services/projectReplayHandler";

const baseRow: OutboxRow = {
  id: "row-1",
  entity: "project",
  entityId: "project-1",
  op: "create",
  payload: {},
  status: "pending",
  attempts: 0,
  lastError: null,
  createdAt: "2026-09-13T00:00:00.000Z",
  syncedAt: null,
};

describe("projectReplayHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dispatches a create row to apiProjects.createProject with its payload", async () => {
    vi.mocked(apiProjects.createProject).mockResolvedValue({} as never);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    await createReplayer("token-123")({
      ...baseRow,
      op: "create",
      payload: { id: "project-1", name: "Site" },
    });

    expect(apiProjects.createProject).toHaveBeenCalledWith("token-123", {
      id: "project-1",
      name: "Site",
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["projects"] });
  });

  it("dispatches an update row to apiProjects.updateProject with the entityId and payload", async () => {
    vi.mocked(apiProjects.updateProject).mockResolvedValue({} as never);

    await createReplayer("token-123")({
      ...baseRow,
      op: "update",
      payload: { name: "renamed" },
    });

    expect(apiProjects.updateProject).toHaveBeenCalledWith(
      "token-123",
      "project-1",
      { name: "renamed" },
    );
  });

  it("dispatches an archive row to apiProjects.updateProject the same way as update", async () => {
    vi.mocked(apiProjects.updateProject).mockResolvedValue({} as never);

    await createReplayer("token-123")({
      ...baseRow,
      op: "archive",
      payload: { archived: true },
    });

    expect(apiProjects.updateProject).toHaveBeenCalledWith(
      "token-123",
      "project-1",
      { archived: true },
    );
  });

  it("dispatches a delete row to apiProjects.deleteProject with the entityId", async () => {
    vi.mocked(apiProjects.deleteProject).mockResolvedValue({
      id: "project-1",
    });

    await createReplayer("token-123")({ ...baseRow, op: "delete" });

    expect(apiProjects.deleteProject).toHaveBeenCalledWith(
      "token-123",
      "project-1",
    );
  });

  it("propagates the API error and does not invalidate on failure", async () => {
    vi.mocked(apiProjects.createProject).mockRejectedValue(
      new Error("A general contractor is required"),
    );
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    await expect(
      createReplayer("token-123")({
        ...baseRow,
        op: "create",
        payload: { id: "project-1", name: "Site" },
      }),
    ).rejects.toThrow("A general contractor is required");

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
