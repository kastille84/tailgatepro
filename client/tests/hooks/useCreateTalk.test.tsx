import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useCreateTalk } from "../../src/hooks/useCreateTalk";
import * as apiTalks from "../../src/services/apiTalks";

vi.mock("react-hot-toast");
vi.mock("../../src/services/apiTalks");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

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
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("initializes with isCreating false", () => {
    const { result } = renderHook(() => useCreateTalk(), { wrapper });
    expect(result.current.isCreating).toBe(false);
  });

  it("calls createTalk with the token and input, then invalidates the talks query", async () => {
    vi.mocked(apiTalks.createTalk).mockResolvedValue(talk);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateTalk(), { wrapper });

    await result.current.createTalk({
      title: "Ladder Safety Refresher",
      talkingPoints: ["Inspect rungs before use"],
    });

    expect(apiTalks.createTalk).toHaveBeenCalledWith("token-123", {
      title: "Ladder Safety Refresher",
      talkingPoints: ["Inspect rungs before use"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["talks"] });
  });

  it("toasts the error and rejects when the mutation fails", async () => {
    vi.mocked(apiTalks.createTalk).mockRejectedValue(
      new Error("Title is required"),
    );

    const { result } = renderHook(() => useCreateTalk(), { wrapper });

    await expect(
      result.current.createTalk({ title: "", talkingPoints: [] }),
    ).rejects.toThrow("Title is required");

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Title is required"),
    );
  });
});
