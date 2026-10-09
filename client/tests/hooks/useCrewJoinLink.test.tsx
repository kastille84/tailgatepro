import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useCrewJoinLink } from "../../src/hooks/useCrewJoinLink";
import * as api from "../../src/services/apiInHouseCrews";

vi.mock("react-hot-toast");
vi.mock("../../src/services/apiInHouseCrews");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const link = { joinUrl: "https://x/crew-join/t", expiresAt: "2026-02-01", usesLeft: 10 };

describe("useCrewJoinLink", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ session: { access_token: "token-123" } });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("loads the crew's link with the session token", async () => {
    vi.mocked(api.getCrewJoinLink).mockResolvedValue(link);

    const { result } = renderHook(() => useCrewJoinLink("c1"), { wrapper });
    expect(result.current.link).toBeNull();

    await waitFor(() => expect(result.current.link).toEqual(link));
    expect(api.getCrewJoinLink).toHaveBeenCalledWith("token-123", "c1");
    expect(result.current.isError).toBe(false);
  });

  it("treats a crew with no link as null", async () => {
    vi.mocked(api.getCrewJoinLink).mockResolvedValue(null);

    const { result } = renderHook(() => useCrewJoinLink("c1"), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.link).toBeNull();
  });

  it("reports an error", async () => {
    vi.mocked(api.getCrewJoinLink).mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useCrewJoinLink("c1"), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("does not fetch without a session or a crew id", () => {
    mockUseAuth.mockReturnValue({ session: null });
    renderHook(() => useCrewJoinLink("c1"), { wrapper });

    mockUseAuth.mockReturnValue({ session: { access_token: "token-123" } });
    renderHook(() => useCrewJoinLink(undefined), { wrapper });

    expect(api.getCrewJoinLink).not.toHaveBeenCalled();
  });

  it("creates a link and puts it straight into the cache", async () => {
    vi.mocked(api.getCrewJoinLink).mockResolvedValue(null);
    vi.mocked(api.createCrewJoinLink).mockResolvedValue(link);

    const { result } = renderHook(() => useCrewJoinLink("c1"), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.createLink();
    });

    expect(api.createCrewJoinLink).toHaveBeenCalledWith("token-123", "c1");
    await waitFor(() => expect(result.current.link).toEqual(link));
    expect(queryClient.getQueryData(["crewJoinLink", "c1"])).toEqual(link);
  });

  it("turns the link off, clears the cache and toasts", async () => {
    vi.mocked(api.getCrewJoinLink).mockResolvedValue(link);
    vi.mocked(api.deleteCrewJoinLink).mockResolvedValue(undefined);

    const { result } = renderHook(() => useCrewJoinLink("c1"), { wrapper });
    await waitFor(() => expect(result.current.link).toEqual(link));
    await act(async () => {
      await result.current.turnOff();
    });

    expect(api.deleteCrewJoinLink).toHaveBeenCalledWith("token-123", "c1");
    await waitFor(() => expect(result.current.link).toBeNull());
    expect(toast.success).toHaveBeenCalledWith("Join link turned off");
  });

  it("toasts the server message when creating or turning off fails", async () => {
    vi.mocked(api.getCrewJoinLink).mockResolvedValue(link);
    vi.mocked(api.createCrewJoinLink).mockRejectedValue(new Error("create failed"));
    vi.mocked(api.deleteCrewJoinLink).mockRejectedValue(new Error("off failed"));

    const { result } = renderHook(() => useCrewJoinLink("c1"), { wrapper });
    await waitFor(() => expect(result.current.link).toEqual(link));

    await act(async () => {
      await result.current.createLink().catch(() => undefined);
    });
    await act(async () => {
      await result.current.turnOff().catch(() => undefined);
    });

    expect(toast.error).toHaveBeenCalledWith("create failed");
    expect(toast.error).toHaveBeenCalledWith("off failed");
  });
});
