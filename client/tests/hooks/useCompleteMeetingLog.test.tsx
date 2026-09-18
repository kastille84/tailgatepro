import React from "react";
import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useCompleteMeetingLog } from "../../src/hooks/useCompleteMeetingLog";
import * as outbox from "../../src/utils/db/outbox";
import * as replayRegistry from "../../src/utils/db/replayRegistry";

vi.mock("react-hot-toast");
vi.mock("../../src/utils/db/outbox");
vi.mock("../../src/utils/db/replayRegistry");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockReplayer = vi.fn();

describe("useCompleteMeetingLog", () => {
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
  });

  afterEach(() => {
    onlineManager.setOnline(true);
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("initializes with isCompleting false", () => {
    const { result } = renderHook(() => useCompleteMeetingLog(), { wrapper });
    expect(result.current.isCompleting).toBe(false);
  });

  it("runs mutationFn immediately even when TanStack Query's onlineManager reports offline", async () => {
    onlineManager.setOnline(false);
    vi.mocked(outbox.enqueueMutation).mockResolvedValue({} as never);

    const { result } = renderHook(() => useCompleteMeetingLog(), { wrapper });
    await result.current.completeMeetingLog({
      meetingId: "meeting-1",
      signatureIds: ["signature-1"],
    });

    expect(outbox.enqueueMutation).toHaveBeenCalled();
  });

  it("enqueues a meeting_completion row keyed by the meetingId, depending on every signatureId", async () => {
    vi.mocked(outbox.enqueueMutation).mockResolvedValue({} as never);

    const { result } = renderHook(() => useCompleteMeetingLog(), { wrapper });
    await result.current.completeMeetingLog({
      meetingId: "meeting-1",
      signatureIds: ["signature-1", "signature-2"],
    });

    expect(replayRegistry.createReplayer).toHaveBeenCalledWith("token-123");
    expect(outbox.enqueueMutation).toHaveBeenCalledWith(
      {
        entity: "meeting_completion",
        entityId: "meeting-1",
        op: "complete",
        payload: {},
        dependsOnEntityIds: ["signature-1", "signature-2"],
      },
      mockReplayer,
    );
  });

  it("enqueues with no replayer when there is no signed-in session", async () => {
    mockUseAuth.mockReturnValue({ session: null });
    vi.mocked(outbox.enqueueMutation).mockResolvedValue({} as never);

    const { result } = renderHook(() => useCompleteMeetingLog(), { wrapper });
    await result.current.completeMeetingLog({
      meetingId: "meeting-1",
      signatureIds: ["signature-1"],
    });

    expect(replayRegistry.createReplayer).not.toHaveBeenCalled();
    expect(outbox.enqueueMutation).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
    );
  });

  it("toasts and rejects when enqueue fails", async () => {
    vi.mocked(outbox.enqueueMutation).mockRejectedValue(
      new Error("Couldn't save your change locally — try again."),
    );

    const { result } = renderHook(() => useCompleteMeetingLog(), { wrapper });

    await expect(
      result.current.completeMeetingLog({
        meetingId: "meeting-1",
        signatureIds: ["signature-1"],
      }),
    ).rejects.toThrow("Couldn't save your change locally");
    expect(toast.error).toHaveBeenCalledWith(
      "Couldn't save your change locally — try again.",
    );
  });
});
