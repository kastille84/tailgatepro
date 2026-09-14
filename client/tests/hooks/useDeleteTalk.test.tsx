import React from "react";
import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useDeleteTalk } from "../../src/hooks/useDeleteTalk";
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

const talk = {
  id: "talk-2",
  slug: null,
  title: "Ladder Safety Refresher",
  tradeTag: "Roofing",
  tradeTags: ["Roofing"],
  content: "# Ladder Safety Refresher\n",
  structured: null,
  attribution: null,
  isGlobal: false,
  companyId: "company-1",
  createdAt: "2026-09-12",
};

describe("useDeleteTalk", () => {
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

  it("initializes with isDeleting false", () => {
    const { result } = renderHook(() => useDeleteTalk(), { wrapper });
    expect(result.current.isDeleting).toBe(false);
  });

  it("runs mutationFn immediately even when TanStack Query's onlineManager reports offline", async () => {
    onlineManager.setOnline(false);
    vi.mocked(outbox.enqueueMutation).mockResolvedValue({} as never);

    const { result } = renderHook(() => useDeleteTalk(), { wrapper });
    await result.current.deleteTalk("talk-2");

    expect(outbox.enqueueMutation).toHaveBeenCalled();
  });

  it("enqueues a delete by id, toasts success", async () => {
    vi.mocked(outbox.enqueueMutation).mockResolvedValue({} as never);

    const { result } = renderHook(() => useDeleteTalk(), { wrapper });
    await result.current.deleteTalk("talk-2");

    expect(outbox.enqueueMutation).toHaveBeenCalledWith(
      { entity: "talk", entityId: "talk-2", op: "delete", payload: {} },
      mockReplayer,
    );
    expect(toast.success).toHaveBeenCalledWith("Talk deleted");
  });

  it("enqueues with no replayer when there is no signed-in session", async () => {
    mockUseAuth.mockReturnValue({ session: null });
    vi.mocked(outbox.enqueueMutation).mockResolvedValue({} as never);

    const { result } = renderHook(() => useDeleteTalk(), { wrapper });
    await result.current.deleteTalk("talk-2");

    expect(replayRegistry.createReplayer).not.toHaveBeenCalled();
    expect(outbox.enqueueMutation).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
    );
  });

  it("optimistically removes the talk from the cached list", async () => {
    vi.mocked(outbox.enqueueMutation).mockResolvedValue({} as never);
    queryClient.setQueryData(["talks"], [talk]);

    const { result } = renderHook(() => useDeleteTalk(), { wrapper });
    await result.current.deleteTalk("talk-2");

    expect(queryClient.getQueryData(["talks"])).toEqual([]);
  });

  it("rolls back, toasts the error (e.g. the 409 in-use guard), and rejects", async () => {
    vi.mocked(outbox.enqueueMutation).mockRejectedValue(
      new Error(
        "This talk has been used in a logged safety talk and can't be edited or deleted.",
      ),
    );
    queryClient.setQueryData(["talks"], [talk]);

    const { result } = renderHook(() => useDeleteTalk(), { wrapper });

    await expect(result.current.deleteTalk("talk-2")).rejects.toThrow(
      "can't be edited or deleted.",
    );
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("can't be edited or deleted."),
      ),
    );
    expect(queryClient.getQueryData(["talks"])).toEqual([talk]);
  });
});
