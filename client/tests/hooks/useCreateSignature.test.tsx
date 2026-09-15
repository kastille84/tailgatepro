import React from "react";
import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useCreateSignature } from "../../src/hooks/useCreateSignature";
import * as outbox from "../../src/utils/db/outbox";
import * as replayRegistry from "../../src/utils/db/replayRegistry";

vi.mock("react-hot-toast");
vi.mock("../../src/utils/db/outbox");
vi.mock("../../src/utils/db/replayRegistry");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const mockReplayer = vi.fn();

describe("useCreateSignature", () => {
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

  it("initializes with isCreating false", () => {
    const { result } = renderHook(() => useCreateSignature(), { wrapper });
    expect(result.current.isCreating).toBe(false);
  });

  it("runs mutationFn immediately even when TanStack Query's onlineManager reports offline", async () => {
    onlineManager.setOnline(false);
    vi.mocked(outbox.enqueueMutation).mockResolvedValue({} as never);

    const { result } = renderHook(() => useCreateSignature(), { wrapper });
    await result.current.createSignature({
      meetingId: "meeting-1",
      workerName: "Jordan Smith",
    });

    expect(outbox.enqueueMutation).toHaveBeenCalled();
  });

  it("enqueues a create with a generated id, dependsOnEntityId set to the meetingId, and returns the id", async () => {
    vi.mocked(outbox.enqueueMutation).mockResolvedValue({} as never);

    const { result } = renderHook(() => useCreateSignature(), { wrapper });
    const id = await result.current.createSignature({
      meetingId: "meeting-1",
      workerName: "Jordan Smith",
      quizAnswers: [{ questionIndex: 0, selectedIndex: 1 }],
    });

    expect(id).toMatch(UUID_RE);
    expect(replayRegistry.createReplayer).toHaveBeenCalledWith("token-123");
    expect(outbox.enqueueMutation).toHaveBeenCalledWith(
      {
        entity: "signature",
        entityId: id,
        op: "create",
        payload: {
          meetingId: "meeting-1",
          id,
          workerName: "Jordan Smith",
          quizAnswers: [{ questionIndex: 0, selectedIndex: 1 }],
        },
        dependsOnEntityId: "meeting-1",
      },
      mockReplayer,
    );
  });

  it("enqueues with no replayer when there is no signed-in session", async () => {
    mockUseAuth.mockReturnValue({ session: null });
    vi.mocked(outbox.enqueueMutation).mockResolvedValue({} as never);

    const { result } = renderHook(() => useCreateSignature(), { wrapper });
    await result.current.createSignature({
      meetingId: "meeting-1",
      workerName: "Jordan Smith",
    });

    expect(replayRegistry.createReplayer).not.toHaveBeenCalled();
    expect(outbox.enqueueMutation).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
    );
  });

  it("toasts and rejects when enqueue fails", async () => {
    vi.mocked(outbox.enqueueMutation).mockRejectedValue(
      new Error("Worker name is required"),
    );

    const { result } = renderHook(() => useCreateSignature(), { wrapper });

    await expect(
      result.current.createSignature({
        meetingId: "meeting-1",
        workerName: "",
      }),
    ).rejects.toThrow("Worker name is required");
    expect(toast.error).toHaveBeenCalledWith("Worker name is required");
  });
});
