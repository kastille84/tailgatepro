import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useGenerateTalk } from "../../src/hooks/useGenerateTalk";
import * as apiTalkGeneration from "../../src/services/apiTalkGeneration";

vi.mock("../../src/services/apiTalkGeneration");
vi.mock("react-hot-toast", () => ({ default: { error: vi.fn() } }));

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockUseOnlineStatus = vi.fn();
vi.mock("../../src/context/online-status", () => ({
  useOnlineStatus: () => mockUseOnlineStatus(),
}));

const mockUseCurrentUser = vi.fn();
vi.mock("../../src/hooks/useCurrentUser", () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));

const draft = {
  title: "Trench Safety",
  tradeTag: "General",
  summary: "",
  talkingPoints: ["Never enter an unprotected trench."],
  siteHazardsToCheck: [],
  discussionQuestions: [],
  oshaStandards: [],
  estimatedMinutes: 5,
};

describe("useGenerateTalk", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ session: { access_token: "token-123" } });
    mockUseOnlineStatus.mockReturnValue({ isOnline: true });
    mockUseCurrentUser.mockReturnValue({ hasAiTalkBuilderAccess: true });
    vi.mocked(apiTalkGeneration.getAiTalkUsage).mockResolvedValue({
      used: 2,
      limit: 10,
      remaining: 8,
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("loads this month's usage when online with access", async () => {
    const { result } = renderHook(() => useGenerateTalk(), { wrapper });

    await waitFor(() => expect(result.current.usage?.remaining).toBe(8));
    expect(apiTalkGeneration.getAiTalkUsage).toHaveBeenCalledWith("token-123");
    expect(result.current.hasAccess).toBe(true);
    expect(result.current.isOnline).toBe(true);
  });

  it.each([
    ["offline", () => mockUseOnlineStatus.mockReturnValue({ isOnline: false })],
    ["without plan access", () => mockUseCurrentUser.mockReturnValue({ hasAiTalkBuilderAccess: false })],
    ["without a session", () => mockUseAuth.mockReturnValue({ session: null })],
  ])("does not load usage %s", (_label, arrange) => {
    arrange();

    const { result } = renderHook(() => useGenerateTalk(), { wrapper });

    expect(apiTalkGeneration.getAiTalkUsage).not.toHaveBeenCalled();
    expect(result.current.usage).toBeNull();
  });

  it("returns the draft and updates the cached usage on success", async () => {
    vi.mocked(apiTalkGeneration.generateTalkDraft).mockResolvedValue({
      draft,
      usage: { used: 3, limit: 10, remaining: 7 },
    });
    const { result } = renderHook(() => useGenerateTalk(), { wrapper });
    await waitFor(() => expect(result.current.usage?.remaining).toBe(8));

    let returned;
    await act(async () => {
      returned = await result.current.generateDraft({ topic: "trenching" });
    });

    expect(apiTalkGeneration.generateTalkDraft).toHaveBeenCalledWith("token-123", {
      topic: "trenching",
    });
    expect(returned).toEqual({ draft, usage: { used: 3, limit: 10, remaining: 7 } });
    await waitFor(() => expect(result.current.usage?.remaining).toBe(7));
  });

  it("toasts the error and re-reads usage when generation fails", async () => {
    vi.mocked(apiTalkGeneration.generateTalkDraft).mockRejectedValue(
      new Error("You've used all 10 AI drafts for this month"),
    );
    const { result } = renderHook(() => useGenerateTalk(), { wrapper });
    await waitFor(() => expect(result.current.usage).not.toBeNull());
    vi.mocked(apiTalkGeneration.getAiTalkUsage).mockClear();

    await act(async () => {
      await expect(
        result.current.generateDraft({ topic: "trenching" }),
      ).rejects.toThrow();
    });

    expect(toast.error).toHaveBeenCalledWith(
      "You've used all 10 AI drafts for this month",
    );
    await waitFor(() =>
      expect(apiTalkGeneration.getAiTalkUsage).toHaveBeenCalled(),
    );
  });
});
