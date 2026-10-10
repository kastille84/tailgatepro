import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useCrewMembers } from "../../src/hooks/useCrewMembers";
import * as api from "../../src/services/apiInHouseCrews";

vi.mock("react-hot-toast");
vi.mock("../../src/services/apiInHouseCrews");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const member = { id: "u1", name: "Jamie", role: "foreman" as const, email: "j@example.com" };

describe("useCrewMembers", () => {
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

  it("loads the crew's people with the session token", async () => {
    vi.mocked(api.listCrewMembers).mockResolvedValue([member]);

    const { result } = renderHook(() => useCrewMembers("c1"), { wrapper });
    expect(result.current.members).toEqual([]);

    await waitFor(() => expect(result.current.members).toEqual([member]));
    expect(api.listCrewMembers).toHaveBeenCalledWith("token-123", "c1");
  });

  it("reports an error", async () => {
    vi.mocked(api.listCrewMembers).mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useCrewMembers("c1"), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("does not fetch without a session or a crew id", () => {
    mockUseAuth.mockReturnValue({ session: null });
    renderHook(() => useCrewMembers("c1"), { wrapper });

    mockUseAuth.mockReturnValue({ session: { access_token: "token-123" } });
    renderHook(() => useCrewMembers(undefined), { wrapper });

    expect(api.listCrewMembers).not.toHaveBeenCalled();
  });

  it("removes a person, refreshes the list and toasts", async () => {
    vi.mocked(api.listCrewMembers).mockResolvedValue([member]);
    vi.mocked(api.removeCrewMember).mockResolvedValue(undefined);
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCrewMembers("c1"), { wrapper });
    await waitFor(() => expect(result.current.members).toEqual([member]));
    await act(async () => {
      await result.current.removeMember("u1");
    });

    expect(api.removeCrewMember).toHaveBeenCalledWith("token-123", "c1", "u1");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["crewMembers", "c1"] });
    expect(toast.success).toHaveBeenCalledWith("Removed from the crew");
    await waitFor(() => expect(result.current.isRemoving).toBe(false));
  });

  it("toasts the server message when a removal fails", async () => {
    vi.mocked(api.listCrewMembers).mockResolvedValue([member]);
    vi.mocked(api.removeCrewMember).mockRejectedValue(new Error("Person not found"));

    const { result } = renderHook(() => useCrewMembers("c1"), { wrapper });
    await waitFor(() => expect(result.current.members).toEqual([member]));
    await act(async () => {
      await result.current.removeMember("u1").catch(() => undefined);
    });

    expect(toast.error).toHaveBeenCalledWith("Person not found");
  });
});
