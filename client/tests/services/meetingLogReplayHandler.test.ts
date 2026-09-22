import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/services/apiMeetingLogs");
vi.mock("../../src/utils/db/mediaBlobs");

import * as apiMeetingLogs from "../../src/services/apiMeetingLogs";
import * as mediaBlobs from "../../src/utils/db/mediaBlobs";
import { createReplayer } from "../../src/utils/db/replayRegistry";
import type { OutboxRow } from "../../src/interfaces/sync";

// Registers the "meeting_log", "crew_photo", and "meeting_completion"
// handlers as a side effect — matches how it's actually wired up (a
// side-effect import in App.tsx).
import "../../src/services/meetingLogReplayHandler";

const baseRow: OutboxRow = {
  id: "row-1",
  entity: "meeting_log",
  entityId: "meeting-1",
  op: "create",
  payload: {},
  status: "pending",
  attempts: 0,
  lastError: null,
  createdAt: "2026-09-15T00:00:00.000Z",
  syncedAt: null,
};

describe("meetingLogReplayHandler (entity: meeting_log)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dispatches a create row to apiMeetingLogs.createMeetingLog with its payload", async () => {
    vi.mocked(apiMeetingLogs.createMeetingLog).mockResolvedValue({} as never);

    await createReplayer("token-123")({
      ...baseRow,
      op: "create",
      payload: { id: "meeting-1", projectId: "project-1" },
    });

    expect(apiMeetingLogs.createMeetingLog).toHaveBeenCalledWith(
      "token-123",
      { id: "meeting-1", projectId: "project-1" },
    );
  });

  it("propagates the API error on failure", async () => {
    vi.mocked(apiMeetingLogs.createMeetingLog).mockRejectedValue(
      new Error("That project doesn't exist"),
    );

    await expect(
      createReplayer("token-123")({
        ...baseRow,
        op: "create",
        payload: { id: "meeting-1", projectId: "project-1" },
      }),
    ).rejects.toThrow("That project doesn't exist");
  });
});

describe("meetingLogReplayHandler (entity: crew_photo)", () => {
  const blobRow = {
    id: "blob-1",
    blob: {} as Blob,
    mimeType: "image/jpeg",
    createdAt: "2026-09-15T00:00:00.000Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uploads the stored blob raw and deletes it once the upload succeeds", async () => {
    vi.mocked(mediaBlobs.getMediaBlob).mockResolvedValue(blobRow);
    vi.mocked(apiMeetingLogs.uploadCrewPhoto).mockResolvedValue({} as never);

    await createReplayer("token-123")({
      ...baseRow,
      entity: "crew_photo",
      op: "update",
      entityId: "meeting-1",
      payload: { mediaBlobId: "blob-1" },
    });

    expect(mediaBlobs.getMediaBlob).toHaveBeenCalledWith("blob-1");
    expect(apiMeetingLogs.uploadCrewPhoto).toHaveBeenCalledWith(
      "token-123",
      "meeting-1",
      blobRow.blob,
    );
    expect(mediaBlobs.deleteMediaBlob).toHaveBeenCalledWith("blob-1");
  });

  it("throws without uploading or deleting when the local blob is missing", async () => {
    vi.mocked(mediaBlobs.getMediaBlob).mockResolvedValue(undefined);

    await expect(
      createReplayer("token-123")({
        ...baseRow,
        entity: "crew_photo",
        op: "update",
        entityId: "meeting-1",
        payload: { mediaBlobId: "blob-1" },
      }),
    ).rejects.toThrow("no longer available locally");

    expect(apiMeetingLogs.uploadCrewPhoto).not.toHaveBeenCalled();
    expect(mediaBlobs.deleteMediaBlob).not.toHaveBeenCalled();
  });

  it("does not delete the local blob when the upload fails", async () => {
    vi.mocked(mediaBlobs.getMediaBlob).mockResolvedValue(blobRow);
    vi.mocked(apiMeetingLogs.uploadCrewPhoto).mockRejectedValue(
      new Error("network down"),
    );

    await expect(
      createReplayer("token-123")({
        ...baseRow,
        entity: "crew_photo",
        op: "update",
        entityId: "meeting-1",
        payload: { mediaBlobId: "blob-1" },
      }),
    ).rejects.toThrow("network down");

    expect(mediaBlobs.deleteMediaBlob).not.toHaveBeenCalled();
  });
});

describe("meetingLogReplayHandler (entity: meeting_completion)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dispatches a complete row to apiMeetingLogs.completeMeeting with the row's entityId and the payload's heldAt", async () => {
    vi.mocked(apiMeetingLogs.completeMeeting).mockResolvedValue({} as never);

    await createReplayer("token-123")({
      ...baseRow,
      entity: "meeting_completion",
      op: "complete",
      entityId: "meeting-1",
      payload: { heldAt: "2026-09-20T22:30:00.000Z" },
    });

    expect(apiMeetingLogs.completeMeeting).toHaveBeenCalledWith(
      "token-123",
      "meeting-1",
      "2026-09-20T22:30:00.000Z",
    );
  });

  it("still replays a completion queued before heldAt existed (empty payload), passing no heldAt so the server falls back to receipt time", async () => {
    vi.mocked(apiMeetingLogs.completeMeeting).mockResolvedValue({} as never);

    await createReplayer("token-123")({
      ...baseRow,
      entity: "meeting_completion",
      op: "complete",
      entityId: "meeting-1",
      payload: {},
    });

    expect(apiMeetingLogs.completeMeeting).toHaveBeenCalledWith(
      "token-123",
      "meeting-1",
      undefined,
    );
  });

  it("propagates the API error on failure", async () => {
    vi.mocked(apiMeetingLogs.completeMeeting).mockRejectedValue(
      new Error("A meeting needs at least one signature before it can be completed."),
    );

    await expect(
      createReplayer("token-123")({
        ...baseRow,
        entity: "meeting_completion",
        op: "complete",
        entityId: "meeting-1",
        payload: {},
      }),
    ).rejects.toThrow("at least one signature");
  });
});
