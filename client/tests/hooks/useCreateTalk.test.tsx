import React from "react";
import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useCreateTalk } from "../../src/hooks/useCreateTalk";
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

describe("useCreateTalk", () => {
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
    const { result } = renderHook(() => useCreateTalk(), { wrapper });
    expect(result.current.isCreating).toBe(false);
  });

  it("runs mutationFn immediately even when TanStack Query's onlineManager reports offline", async () => {
    // Without networkMode: "always", the default networkMode: "online" would
    // pause mutationFn — the outbox write included — until onlineManager
    // sees an `online` event, instead of running immediately and letting the
    // outbox's own navigator.onLine check decide what happens next.
    onlineManager.setOnline(false);
    vi.mocked(outbox.enqueueMutation).mockResolvedValue({} as never);

    const { result } = renderHook(() => useCreateTalk(), { wrapper });
    await result.current.createTalk({
      title: "Ladder Safety Refresher",
      talkingPoints: ["Inspect rungs before use"],
    });

    expect(outbox.enqueueMutation).toHaveBeenCalled();
  });

  it("enqueues a create with a generated id and the given replayer", async () => {
    vi.mocked(outbox.enqueueMutation).mockResolvedValue({} as never);

    const { result } = renderHook(() => useCreateTalk(), { wrapper });
    await result.current.createTalk({
      title: "Ladder Safety Refresher",
      tradeTag: "Roofing",
      talkingPoints: ["Inspect rungs before use"],
    });

    expect(replayRegistry.createReplayer).toHaveBeenCalledWith("token-123");
    expect(outbox.enqueueMutation).toHaveBeenCalledWith(
      {
        entity: "talk",
        entityId: expect.stringMatching(UUID_RE),
        op: "create",
        payload: expect.objectContaining({
          id: expect.stringMatching(UUID_RE),
          title: "Ladder Safety Refresher",
          tradeTag: "Roofing",
          talkingPoints: ["Inspect rungs before use"],
        }),
      },
      mockReplayer,
    );
  });

  it("optimistically adds the new talk to the cached talks list", async () => {
    vi.mocked(outbox.enqueueMutation).mockResolvedValue({} as never);
    queryClient.setQueryData(["talks"], []);

    const { result } = renderHook(() => useCreateTalk(), { wrapper });
    await result.current.createTalk({
      title: "Ladder Safety Refresher",
      tradeTag: "Roofing",
      talkingPoints: ["Inspect rungs before use"],
    });

    const cached = queryClient.getQueryData<
      { title: string; tradeTags: string[]; structured: unknown }[]
    >(["talks"]);
    expect(cached).toHaveLength(1);
    expect(cached?.[0]).toMatchObject({
      title: "Ladder Safety Refresher",
      tradeTag: "Roofing",
      tradeTags: ["Roofing"],
      structured: {
        talking_points: ["Inspect rungs before use"],
      },
    });
  });

  it("defaults tradeTag/tradeTags to null/[] on the optimistic entry when omitted", async () => {
    vi.mocked(outbox.enqueueMutation).mockResolvedValue({} as never);
    queryClient.setQueryData(["talks"], []);

    const { result } = renderHook(() => useCreateTalk(), { wrapper });
    await result.current.createTalk({
      title: "Untitled talk",
      talkingPoints: ["A point"],
    });

    const cached = queryClient.getQueryData<
      { tradeTag: string | null; tradeTags: string[] }[]
    >(["talks"]);
    expect(cached?.[0]).toMatchObject({ tradeTag: null, tradeTags: [] });
  });

  it("enqueues with no replayer when there is no signed-in session", async () => {
    mockUseAuth.mockReturnValue({ session: null });
    vi.mocked(outbox.enqueueMutation).mockResolvedValue({} as never);

    const { result } = renderHook(() => useCreateTalk(), { wrapper });
    await result.current.createTalk({
      title: "Ladder Safety Refresher",
      talkingPoints: ["Inspect rungs before use"],
    });

    expect(replayRegistry.createReplayer).not.toHaveBeenCalled();
    expect(outbox.enqueueMutation).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
    );
  });

  it("rolls back the optimistic entry, toasts, and rejects when enqueue fails", async () => {
    vi.mocked(outbox.enqueueMutation).mockRejectedValue(
      new Error("Title is required"),
    );
    queryClient.setQueryData(["talks"], []);

    const { result } = renderHook(() => useCreateTalk(), { wrapper });

    await expect(
      result.current.createTalk({ title: "", talkingPoints: [] }),
    ).rejects.toThrow("Title is required");

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Title is required"),
    );
    expect(queryClient.getQueryData(["talks"])).toEqual([]);
  });
});
