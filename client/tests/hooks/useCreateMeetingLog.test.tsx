import React from "react";
import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useCreateMeetingLog } from "../../src/hooks/useCreateMeetingLog";
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

describe("useCreateMeetingLog", () => {
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
    const { result } = renderHook(() => useCreateMeetingLog(), { wrapper });
    expect(result.current.isCreating).toBe(false);
  });

  it("runs mutationFn immediately even when TanStack Query's onlineManager reports offline", async () => {
    onlineManager.setOnline(false);
    vi.mocked(outbox.enqueueMutation).mockResolvedValue({} as never);

    const { result } = renderHook(() => useCreateMeetingLog(), { wrapper });
    await result.current.createMeetingLog({ projectId: "project-1" });

    expect(outbox.enqueueMutation).toHaveBeenCalled();
  });

  it("enqueues a create with a generated id and the given replayer, and returns the id", async () => {
    vi.mocked(outbox.enqueueMutation).mockResolvedValue({} as never);

    const { result } = renderHook(() => useCreateMeetingLog(), { wrapper });
    const id = await result.current.createMeetingLog({
      projectId: "project-1",
      talkId: "talk-1",
    });

    expect(id).toMatch(UUID_RE);
    expect(replayRegistry.createReplayer).toHaveBeenCalledWith("token-123");
    expect(outbox.enqueueMutation).toHaveBeenCalledWith(
      {
        entity: "meeting_log",
        entityId: id,
        op: "create",
        payload: { id, projectId: "project-1", talkId: "talk-1" },
      },
      mockReplayer,
    );
  });

  it("enqueues with no replayer when there is no signed-in session", async () => {
    mockUseAuth.mockReturnValue({ session: null });
    vi.mocked(outbox.enqueueMutation).mockResolvedValue({} as never);

    const { result } = renderHook(() => useCreateMeetingLog(), { wrapper });
    await result.current.createMeetingLog({ projectId: "project-1" });

    expect(replayRegistry.createReplayer).not.toHaveBeenCalled();
    expect(outbox.enqueueMutation).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
    );
  });

  it("toasts and rejects when enqueue fails", async () => {
    vi.mocked(outbox.enqueueMutation).mockRejectedValue(
      new Error("That project doesn't exist"),
    );

    const { result } = renderHook(() => useCreateMeetingLog(), { wrapper });

    await expect(
      result.current.createMeetingLog({ projectId: "project-1" }),
    ).rejects.toThrow("That project doesn't exist");
    expect(toast.error).toHaveBeenCalledWith("That project doesn't exist");
  });
});
