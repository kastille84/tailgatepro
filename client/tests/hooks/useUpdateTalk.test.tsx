import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useUpdateTalk } from "../../src/hooks/useUpdateTalk";
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
  title: "Ladder Safety Refresher (Updated)",
  tradeTag: "Roofing",
  tradeTags: ["Roofing"],
  content: "# Ladder Safety Refresher (Updated)\n",
  structured: null,
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
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("initializes with isUpdating false", () => {
    const { result } = renderHook(() => useUpdateTalk(), { wrapper });
    expect(result.current.isUpdating).toBe(false);
  });

  it("calls updateTalk with the token, id and input, then invalidates the talks query", async () => {
    vi.mocked(apiTalks.updateTalk).mockResolvedValue(talk);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateTalk(), { wrapper });

    await result.current.updateTalk({
      id: "talk-2",
      input: {
        title: "Ladder Safety Refresher (Updated)",
        talkingPoints: ["Inspect rungs before use"],
      },
    });

    expect(apiTalks.updateTalk).toHaveBeenCalledWith("token-123", "talk-2", {
      title: "Ladder Safety Refresher (Updated)",
      talkingPoints: ["Inspect rungs before use"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["talks"] });
  });

  it("toasts the error (e.g. the 409 in-use guard) and rejects", async () => {
    vi.mocked(apiTalks.updateTalk).mockRejectedValue(
      new Error(
        "This talk has been used in a logged safety talk and can't be edited or deleted.",
      ),
    );

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
  });
});
