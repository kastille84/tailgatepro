import React from "react";
import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useUpdateTalk } from "../../src/hooks/useUpdateTalk";
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
  structured: {
    summary: null,
    talking_points: ["Inspect rungs before use"],
    site_hazards_to_check: [],
    discussion_questions: [],
    osha_standards: [],
    estimated_minutes: null,
  },
  attribution: null,
  isGlobal: false,
  companyId: "company-1",
  createdAt: "2026-09-12",
};

describe("useUpdateTalk", () => {
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

  it("initializes with isUpdating false", () => {
    const { result } = renderHook(() => useUpdateTalk(), { wrapper });
    expect(result.current.isUpdating).toBe(false);
  });

  it("runs mutationFn immediately even when TanStack Query's onlineManager reports offline", async () => {
    onlineManager.setOnline(false);
    vi.mocked(outbox.enqueueMutation).mockResolvedValue({} as never);

    const { result } = renderHook(() => useUpdateTalk(), { wrapper });
    await result.current.updateTalk({
      id: "talk-2",
      input: { title: "x", talkingPoints: ["y"] },
    });

    expect(outbox.enqueueMutation).toHaveBeenCalled();
  });

  it("enqueues an update with the id, input, and the given replayer", async () => {
    vi.mocked(outbox.enqueueMutation).mockResolvedValue({} as never);

    const { result } = renderHook(() => useUpdateTalk(), { wrapper });
    await result.current.updateTalk({
      id: "talk-2",
      input: {
        title: "Ladder Safety Refresher (Updated)",
        talkingPoints: ["Inspect rungs before use"],
      },
    });

    expect(replayRegistry.createReplayer).toHaveBeenCalledWith("token-123");
    expect(outbox.enqueueMutation).toHaveBeenCalledWith(
      {
        entity: "talk",
        entityId: "talk-2",
        op: "update",
        payload: {
          title: "Ladder Safety Refresher (Updated)",
          talkingPoints: ["Inspect rungs before use"],
        },
      },
      mockReplayer,
    );
  });

  it("enqueues with no replayer when there is no signed-in session", async () => {
    mockUseAuth.mockReturnValue({ session: null });
    vi.mocked(outbox.enqueueMutation).mockResolvedValue({} as never);

    const { result } = renderHook(() => useUpdateTalk(), { wrapper });
    await result.current.updateTalk({
      id: "talk-2",
      input: { title: "x", talkingPoints: ["y"] },
    });

    expect(replayRegistry.createReplayer).not.toHaveBeenCalled();
    expect(outbox.enqueueMutation).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
    );
  });

  it("optimistically full-replaces the cached talk's fields", async () => {
    vi.mocked(outbox.enqueueMutation).mockResolvedValue({} as never);
    queryClient.setQueryData(["talks"], [talk]);

    const { result } = renderHook(() => useUpdateTalk(), { wrapper });
    await result.current.updateTalk({
      id: "talk-2",
      input: {
        title: "Ladder Safety Refresher (Updated)",
        talkingPoints: ["Wear fall protection"],
      },
    });

    const cached = queryClient.getQueryData<
      { id: string; title: string; structured: { talking_points: string[] } }[]
    >(["talks"]);
    expect(cached?.[0]).toMatchObject({
      id: "talk-2",
      title: "Ladder Safety Refresher (Updated)",
      structured: { talking_points: ["Wear fall protection"] },
    });
  });

  it("rolls back the optimistic patch, toasts the error (e.g. the 409 in-use guard), and rejects", async () => {
    vi.mocked(outbox.enqueueMutation).mockRejectedValue(
      new Error(
        "This talk has been used in a logged safety talk and can't be edited or deleted.",
      ),
    );
    queryClient.setQueryData(["talks"], [talk]);

    const { result } = renderHook(() => useUpdateTalk(), { wrapper });

    await expect(
      result.current.updateTalk({
        id: "talk-2",
        input: { title: "x", talkingPoints: ["y"] },
      }),
    ).rejects.toThrow("can't be edited or deleted.");

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("can't be edited or deleted."),
      ),
    );
    expect(queryClient.getQueryData(["talks"])).toEqual([talk]);
  });
});
