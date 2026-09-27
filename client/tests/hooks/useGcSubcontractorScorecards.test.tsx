import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useGcSubcontractorScorecards } from "../../src/hooks/useGcSubcontractorScorecards";
import * as apiGc from "../../src/services/apiGc";
import type { GcSubScorecardSummary } from "../../src/interfaces/gcSubcontractors";

vi.mock("../../src/services/apiGc");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const scorecards: GcSubScorecardSummary[] = [
  { companyId: "sub-1", companyName: "Rivera Electric", overallScore: 87 },
];

describe("useGcSubcontractorScorecards", () => {
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

  it("fetches the scorecards for the given date and tzOffset", async () => {
    vi.mocked(apiGc.getGcSubcontractorScorecards).mockResolvedValue(scorecards);

    const { result } = renderHook(() => useGcSubcontractorScorecards("2026-09-21", 300), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(apiGc.getGcSubcontractorScorecards).toHaveBeenCalledWith(
      "token-123",
      "2026-09-21",
      300,
    );
    expect(result.current.scorecards).toEqual(scorecards);
    expect(result.current.isError).toBe(false);
  });

  it("defaults scorecards to null and reports the error on failure", async () => {
    vi.mocked(apiGc.getGcSubcontractorScorecards).mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useGcSubcontractorScorecards("2026-09-21", 300), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.scorecards).toBeNull();
  });

  it("is disabled (no fetch) without a session", () => {
    mockUseAuth.mockReturnValue({ session: null });

    const { result } = renderHook(() => useGcSubcontractorScorecards("2026-09-21", 300), {
      wrapper,
    });

    expect(apiGc.getGcSubcontractorScorecards).not.toHaveBeenCalled();
    expect(result.current.scorecards).toBeNull();
  });

  it("reports isLoading true before the query resolves", () => {
    vi.mocked(apiGc.getGcSubcontractorScorecards).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useGcSubcontractorScorecards("2026-09-21", 300), {
      wrapper,
    });

    expect(result.current.isLoading).toBe(true);
  });
});
