import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useJobsiteMembers } from "../../src/hooks/useJobsiteMembers";
import * as apiJobsites from "../../src/services/apiJobsites";

vi.mock("../../src/services/apiJobsites");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("useJobsiteMembers", () => {
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

  it("fetches a jobsite's members with the session token", async () => {
    vi.mocked(apiJobsites.listJobsiteMembers).mockResolvedValue({
      members: [{ userId: "u-1", name: "Ann", assigned: true }],
    });

    const { result } = renderHook(() => useJobsiteMembers("j1"), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(apiJobsites.listJobsiteMembers).toHaveBeenCalledWith("token-123", "j1");
    expect(result.current.members).toEqual([{ userId: "u-1", name: "Ann", assigned: true }]);
    expect(result.current.isError).toBe(false);
  });

  it("returns an empty list and does not fetch without a session", () => {
    mockUseAuth.mockReturnValue({ session: null });

    const { result } = renderHook(() => useJobsiteMembers("j1"), { wrapper });

    expect(result.current.members).toEqual([]);
    expect(apiJobsites.listJobsiteMembers).not.toHaveBeenCalled();
  });

  it("does not fetch without a jobsiteId", () => {
    renderHook(() => useJobsiteMembers(""), { wrapper });

    expect(apiJobsites.listJobsiteMembers).not.toHaveBeenCalled();
  });

  it("reports an error when the fetch fails", async () => {
    vi.mocked(apiJobsites.listJobsiteMembers).mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useJobsiteMembers("j1"), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.members).toEqual([]);
  });
});
