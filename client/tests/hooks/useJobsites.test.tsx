import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useJobsites } from "../../src/hooks/useJobsites";
import * as apiJobsites from "../../src/services/apiJobsites";
import type { Jobsite } from "../../src/interfaces/jobsite";

vi.mock("../../src/services/apiJobsites");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const jobsite: Jobsite = {
  id: "j1",
  gcCompanyId: "gc-1",
  name: "Riverside",
  status: "active",
  archivedAt: null,
  createdBySub: false,
  createdAt: "2026-09-01T00:00:00.000Z",
  subcontractors: [],
};

describe("useJobsites", () => {
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

  it("fetches the GC's jobsites with the session token", async () => {
    vi.mocked(apiJobsites.listJobsites).mockResolvedValue([jobsite]);

    const { result } = renderHook(() => useJobsites(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(apiJobsites.listJobsites).toHaveBeenCalledWith("token-123");
    expect(result.current.jobsites).toEqual([jobsite]);
    expect(result.current.isError).toBe(false);
  });

  it("returns an empty list and does not fetch without a session", () => {
    mockUseAuth.mockReturnValue({ session: null });

    const { result } = renderHook(() => useJobsites(), { wrapper });

    expect(result.current.jobsites).toEqual([]);
    expect(apiJobsites.listJobsites).not.toHaveBeenCalled();
  });

  it("reports an error when the fetch fails", async () => {
    vi.mocked(apiJobsites.listJobsites).mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useJobsites(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.jobsites).toEqual([]);
  });
});
