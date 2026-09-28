import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useGcSubcontractorScorecard } from "../../src/hooks/useGcSubcontractorScorecard";
import * as apiGc from "../../src/services/apiGc";
import type { GcSubScorecardDetail } from "../../src/interfaces/gcSubcontractors";

vi.mock("../../src/services/apiGc");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const detail: GcSubScorecardDetail = {
  companyId: "sub-1",
  companyName: "Rivera Electric",
  overallScore: 87,
  jobsites: [
    {
      jobsiteId: "jobsite-1",
      jobsiteName: "Downtown Tower",
      expectedDays: 30,
      loggedDays: 26,
      score: 87,
    },
  ],
};

describe("useGcSubcontractorScorecard", () => {
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

  it("fetches one sub's scorecard for the given companyId, date and tzOffset", async () => {
    vi.mocked(apiGc.getGcSubcontractorScorecard).mockResolvedValue(detail);

    const { result } = renderHook(
      () => useGcSubcontractorScorecard("sub-1", "2026-09-21", 300),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(apiGc.getGcSubcontractorScorecard).toHaveBeenCalledWith(
      "token-123",
      "sub-1",
      "2026-09-21",
      300,
    );
    expect(result.current.scorecard).toEqual(detail);
    expect(result.current.isError).toBe(false);
  });

  it("defaults scorecard to null and exposes the error on failure", async () => {
    const error = new Error("Subcontractor not found");
    vi.mocked(apiGc.getGcSubcontractorScorecard).mockRejectedValue(error);

    const { result } = renderHook(
      () => useGcSubcontractorScorecard("sub-9", "2026-09-21", 300),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.scorecard).toBeNull();
    expect(result.current.error).toBe(error);
  });

  it("is disabled (no fetch) without a session", () => {
    mockUseAuth.mockReturnValue({ session: null });

    const { result } = renderHook(
      () => useGcSubcontractorScorecard("sub-1", "2026-09-21", 300),
      { wrapper },
    );

    expect(apiGc.getGcSubcontractorScorecard).not.toHaveBeenCalled();
    expect(result.current.scorecard).toBeNull();
  });

  it("is disabled (no fetch) without a companyId", () => {
    const { result } = renderHook(
      () => useGcSubcontractorScorecard("", "2026-09-21", 300),
      { wrapper },
    );

    expect(apiGc.getGcSubcontractorScorecard).not.toHaveBeenCalled();
    expect(result.current.scorecard).toBeNull();
  });
});
