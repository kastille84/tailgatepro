import React from "react";
import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useUploadCrewPhoto } from "../../src/hooks/useUploadCrewPhoto";
import * as mediaBlobs from "../../src/utils/db/mediaBlobs";
import * as outbox from "../../src/utils/db/outbox";
import * as replayRegistry from "../../src/utils/db/replayRegistry";

vi.mock("react-hot-toast");
vi.mock("../../src/utils/db/mediaBlobs");
vi.mock("../../src/utils/db/outbox");
vi.mock("../../src/utils/db/replayRegistry");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockReplayer = vi.fn();
const blob = new Blob(["jpg-bytes"], { type: "image/jpeg" });

describe("useUploadCrewPhoto", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ session: { access_token: "token-123" } });
    vi.mocked(replayRegistry.createReplayer).mockReturnValue(mockReplayer);
    vi.mocked(mediaBlobs.storeMediaBlob).mockResolvedValue("blob-1");
  });

  afterEach(() => {
    onlineManager.setOnline(true);
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("initializes with isUploading false", () => {
    const { result } = renderHook(() => useUploadCrewPhoto(), { wrapper });
    expect(result.current.isUploading).toBe(false);
  });

  it("runs mutationFn immediately even when TanStack Query's onlineManager reports offline", async () => {
    onlineManager.setOnline(false);
    vi.mocked(outbox.enqueueMutation).mockResolvedValue({} as never);

    const { result } = renderHook(() => useUploadCrewPhoto(), { wrapper });
    await result.current.uploadCrewPhoto({ meetingId: "meeting-1", blob });

    expect(outbox.enqueueMutation).toHaveBeenCalled();
  });

  it("stores the blob locally, then enqueues a crew_photo row keyed by the meetingId", async () => {
    vi.mocked(outbox.enqueueMutation).mockResolvedValue({} as never);

    const { result } = renderHook(() => useUploadCrewPhoto(), { wrapper });
    await result.current.uploadCrewPhoto({ meetingId: "meeting-1", blob });

    expect(mediaBlobs.storeMediaBlob).toHaveBeenCalledWith(blob);
    expect(replayRegistry.createReplayer).toHaveBeenCalledWith("token-123");
    expect(outbox.enqueueMutation).toHaveBeenCalledWith(
      {
        entity: "crew_photo",
        entityId: "meeting-1",
        op: "update",
        payload: { mediaBlobId: "blob-1" },
      },
      mockReplayer,
    );
  });

  it("enqueues with no replayer when there is no signed-in session", async () => {
    mockUseAuth.mockReturnValue({ session: null });
    vi.mocked(outbox.enqueueMutation).mockResolvedValue({} as never);

    const { result } = renderHook(() => useUploadCrewPhoto(), { wrapper });
    await result.current.uploadCrewPhoto({ meetingId: "meeting-1", blob });

    expect(replayRegistry.createReplayer).not.toHaveBeenCalled();
    expect(outbox.enqueueMutation).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
    );
  });

  it("toasts and rejects when enqueue fails", async () => {
    vi.mocked(outbox.enqueueMutation).mockRejectedValue(
      new Error("This meeting has already been completed"),
    );

    const { result } = renderHook(() => useUploadCrewPhoto(), { wrapper });

    await expect(
      result.current.uploadCrewPhoto({ meetingId: "meeting-1", blob }),
    ).rejects.toThrow("This meeting has already been completed");
    expect(toast.error).toHaveBeenCalledWith(
      "This meeting has already been completed",
    );
  });
});
