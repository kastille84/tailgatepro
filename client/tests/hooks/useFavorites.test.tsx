import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useFavorites } from "../../src/hooks/useFavorites";
import * as apiFavorites from "../../src/services/apiFavorites";

vi.mock("../../src/services/apiFavorites");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const favorite = {
  talkId: "talk-1",
  createdAt: "2026-09-09T00:00:00.000Z",
};

describe("useFavorites", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ session: { access_token: "token-123" } });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("fetches favorites with the session token and exposes a Set of talk ids", async () => {
    vi.mocked(apiFavorites.listFavorites).mockResolvedValue([favorite]);

    const { result } = renderHook(() => useFavorites(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(apiFavorites.listFavorites).toHaveBeenCalledWith("token-123");
    expect(result.current.favoriteIds).toEqual(new Set(["talk-1"]));
    expect(result.current.isError).toBe(false);
  });

  it("defaults favoriteIds to an empty Set and reports query errors", async () => {
    vi.mocked(apiFavorites.listFavorites).mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useFavorites(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.favoriteIds).toEqual(new Set());
  });

  it("stays disabled and does not fetch when there is no session", () => {
    mockUseAuth.mockReturnValue({ session: null });

    const { result } = renderHook(() => useFavorites(), { wrapper });

    expect(apiFavorites.listFavorites).not.toHaveBeenCalled();
    expect(result.current.favoriteIds).toEqual(new Set());
  });
});
