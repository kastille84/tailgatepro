import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useToggleFavorite } from "../../src/hooks/useToggleFavorite";
import * as apiFavorites from "../../src/services/apiFavorites";

vi.mock("react-hot-toast");
vi.mock("../../src/services/apiFavorites");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const favorite = {
  talkId: "talk-1",
  createdAt: "2026-09-09T00:00:00.000Z",
};

describe("useToggleFavorite", () => {
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

  it("calls addFavorite when isFavorited is false, and invalidates the favorites query", async () => {
    vi.mocked(apiFavorites.addFavorite).mockResolvedValue(favorite);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useToggleFavorite(), { wrapper });
    await result.current.toggleFavorite({ talkId: "talk-1", isFavorited: false });

    expect(apiFavorites.addFavorite).toHaveBeenCalledWith("token-123", "talk-1");
    expect(apiFavorites.removeFavorite).not.toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["favorites"] });
  });

  it("calls removeFavorite when isFavorited is true", async () => {
    vi.mocked(apiFavorites.removeFavorite).mockResolvedValue({ talkId: "talk-1" });

    const { result } = renderHook(() => useToggleFavorite(), { wrapper });
    await result.current.toggleFavorite({ talkId: "talk-1", isFavorited: true });

    expect(apiFavorites.removeFavorite).toHaveBeenCalledWith("token-123", "talk-1");
    expect(apiFavorites.addFavorite).not.toHaveBeenCalled();
  });

  it("toasts the error and rejects when the mutation fails", async () => {
    vi.mocked(apiFavorites.addFavorite).mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useToggleFavorite(), { wrapper });

    await expect(
      result.current.toggleFavorite({ talkId: "talk-1", isFavorited: false }),
    ).rejects.toThrow("boom");
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("boom"));
    expect(toast.success).not.toHaveBeenCalled();
  });
});
