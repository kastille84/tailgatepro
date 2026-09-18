import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/services/apiSignatures");
vi.mock("../../src/utils/db/mediaBlobs");

import * as apiSignatures from "../../src/services/apiSignatures";
import * as mediaBlobs from "../../src/utils/db/mediaBlobs";
import { createReplayer } from "../../src/utils/db/replayRegistry";
import type { OutboxRow } from "../../src/interfaces/sync";

// Registers the "signature" handler as a side effect — matches how it's
// actually wired up (a side-effect import in App.tsx).
import "../../src/services/signatureReplayHandler";

const baseRow: OutboxRow = {
  id: "row-1",
  entity: "signature",
  entityId: "signature-1",
  op: "create",
  payload: {},
  status: "pending",
  attempts: 0,
  lastError: null,
  createdAt: "2026-09-15T00:00:00.000Z",
  syncedAt: null,
};

describe("signatureReplayHandler — create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dispatches a create row to apiSignatures.createSignature, stripping meetingId out of the payload", async () => {
    vi.mocked(apiSignatures.createSignature).mockResolvedValue({} as never);

    await createReplayer("token-123")({
      ...baseRow,
      op: "create",
      payload: {
        id: "signature-1",
        meetingId: "meeting-1",
        workerName: "Jordan Smith",
      },
    });

    expect(apiSignatures.createSignature).toHaveBeenCalledWith(
      "token-123",
      "meeting-1",
      { id: "signature-1", workerName: "Jordan Smith" },
    );
  });

  it("propagates the API error on failure", async () => {
    vi.mocked(apiSignatures.createSignature).mockRejectedValue(
      new Error("Worker name is required"),
    );

    await expect(
      createReplayer("token-123")({
        ...baseRow,
        op: "create",
        payload: { id: "signature-1", meetingId: "meeting-1", workerName: "" },
      }),
    ).rejects.toThrow("Worker name is required");
  });
});

describe("signatureReplayHandler — update (blob upload)", () => {
  const blobRow = {
    id: "blob-1",
    blob: {} as Blob,
    mimeType: "image/png",
    createdAt: "2026-09-15T00:00:00.000Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uploads the stored blob raw and deletes it once the upload succeeds", async () => {
    vi.mocked(mediaBlobs.getMediaBlob).mockResolvedValue(blobRow);
    vi.mocked(apiSignatures.uploadSignatureBlob).mockResolvedValue(
      {} as never,
    );

    await createReplayer("token-123")({
      ...baseRow,
      op: "update",
      payload: { meetingId: "meeting-1", mediaBlobId: "blob-1" },
    });

    expect(mediaBlobs.getMediaBlob).toHaveBeenCalledWith("blob-1");
    expect(apiSignatures.uploadSignatureBlob).toHaveBeenCalledWith(
      "token-123",
      "meeting-1",
      "signature-1",
      blobRow.blob,
    );
    expect(mediaBlobs.deleteMediaBlob).toHaveBeenCalledWith("blob-1");
  });

  it("throws without uploading or deleting when the local blob is missing", async () => {
    vi.mocked(mediaBlobs.getMediaBlob).mockResolvedValue(undefined);

    await expect(
      createReplayer("token-123")({
        ...baseRow,
        op: "update",
        payload: { meetingId: "meeting-1", mediaBlobId: "blob-1" },
      }),
    ).rejects.toThrow("no longer available locally");

    expect(apiSignatures.uploadSignatureBlob).not.toHaveBeenCalled();
    expect(mediaBlobs.deleteMediaBlob).not.toHaveBeenCalled();
  });

  it("does not delete the local blob when the upload fails", async () => {
    vi.mocked(mediaBlobs.getMediaBlob).mockResolvedValue(blobRow);
    vi.mocked(apiSignatures.uploadSignatureBlob).mockRejectedValue(
      new Error("network down"),
    );

    await expect(
      createReplayer("token-123")({
        ...baseRow,
        op: "update",
        payload: { meetingId: "meeting-1", mediaBlobId: "blob-1" },
      }),
    ).rejects.toThrow("network down");

    expect(mediaBlobs.deleteMediaBlob).not.toHaveBeenCalled();
  });
});
