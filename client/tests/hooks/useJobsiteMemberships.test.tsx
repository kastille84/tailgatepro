import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useJobsiteMemberships } from "../../src/hooks/useJobsiteMemberships";
import * as apiJobsites from "../../src/services/apiJobsites";
import type { JobsiteMembership } from "../../src/interfaces/jobsite";

vi.mock("../../src/services/apiJobsites");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const membership: JobsiteMembership = {
  jobsiteId: "j1",
  jobsiteName: "Riverside",
  jobsiteCadence: "weekly",
  subCadence: null,
  effectiveCadence: "weekly",
};

describe("useJobsiteMemberships", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ session: { access_token: "token-123" } });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("fetches the company's memberships with the session token", async () => {
    vi.mocked(apiJobsites.listJobsiteMemberships).mockResolvedValue([membership]);

    const { result } = renderHook(() => useJobsiteMemberships(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(apiJobsites.listJobsiteMemberships).toHaveBeenCalledWith("token-123");
    expect(result.current.memberships).toEqual([membership]);
    expect(result.current.isError).toBe(false);
  });

  it("returns an empty list and does not fetch without a session", () => {
    mockUseAuth.mockReturnValue({ session: null });

    const { result } = renderHook(() => useJobsiteMemberships(), { wrapper });

    expect(result.current.memberships).toEqual([]);
    expect(apiJobsites.listJobsiteMemberships).not.toHaveBeenCalled();
  });

  it("does not fetch when disabled", () => {
    const { result } = renderHook(() => useJobsiteMemberships({ enabled: false }), { wrapper });

    expect(result.current.memberships).toEqual([]);
    expect(apiJobsites.listJobsiteMemberships).not.toHaveBeenCalled();
  });

  it("reports an error when the fetch fails", async () => {
    vi.mocked(apiJobsites.listJobsiteMemberships).mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useJobsiteMemberships(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
