import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useGcOverview } from "../../src/hooks/useGcOverview";
import * as apiGc from "../../src/services/apiGc";
import type { GcOverview } from "../../src/interfaces/gcDashboard";

vi.mock("../../src/services/apiGc");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const overview: GcOverview = {
  jobsites: [
    {
      name: "Downtown Tower",
      subs: [
        {
          companyId: "sub-1",
          companyName: "Rivera Electric",
          projectId: "project-1",
          status: "logged",
          lastLoggedAt: "2026-09-21T13:00:00.000Z",
          count: 1,
        },
      ],
    },
  ],
  totals: { subs: 1, logged: 1, missing: 0 },
};

describe("useGcOverview", () => {
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

  it("fetches the overview for the given date and tzOffset", async () => {
    vi.mocked(apiGc.getGcOverview).mockResolvedValue(overview);

    const { result } = renderHook(() => useGcOverview("2026-09-21", 300), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(apiGc.getGcOverview).toHaveBeenCalledWith(
      "token-123",
      "2026-09-21",
      300,
    );
    expect(result.current.overview).toEqual(overview);
    expect(result.current.isError).toBe(false);
  });

  it("defaults overview to null and reports the error on failure", async () => {
    vi.mocked(apiGc.getGcOverview).mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useGcOverview("2026-09-21", 300), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.overview).toBeNull();
  });

  it("is disabled (no fetch) without a session", () => {
    mockUseAuth.mockReturnValue({ session: null });

    const { result } = renderHook(() => useGcOverview("2026-09-21", 300), {
      wrapper,
    });

    expect(apiGc.getGcOverview).not.toHaveBeenCalled();
    expect(result.current.overview).toBeNull();
  });

  it("reports isLoading true before the query resolves", () => {
    vi.mocked(apiGc.getGcOverview).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useGcOverview("2026-09-21", 300), {
      wrapper,
    });

    expect(result.current.isLoading).toBe(true);
  });
});
