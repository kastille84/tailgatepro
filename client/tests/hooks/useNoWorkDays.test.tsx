import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useNoWorkDays } from "../../src/hooks/useNoWorkDays";
import * as apiNoWorkDays from "../../src/services/apiNoWorkDays";

vi.mock("../../src/services/apiNoWorkDays");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const day = {
  id: "nwd-1",
  jobsiteId: "j1",
  companyId: "c1",
  offDate: "2026-11-26",
  reason: "holiday" as const,
  createdBy: "u1",
  createdAt: "2026-11-20T00:00:00.000Z",
};

describe("useNoWorkDays", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ session: { access_token: "token-123" } });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("fetches the project's marks with the session token", async () => {
    vi.mocked(apiNoWorkDays.listNoWorkDays).mockResolvedValue([day]);

    const { result } = renderHook(() => useNoWorkDays("p1"), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(apiNoWorkDays.listNoWorkDays).toHaveBeenCalledWith("token-123", "p1");
    expect(result.current.noWorkDays).toEqual([day]);
    expect(result.current.isError).toBe(false);
  });

  it("defaults to an empty list and reports query errors", async () => {
    vi.mocked(apiNoWorkDays.listNoWorkDays).mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useNoWorkDays("p1"), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.noWorkDays).toEqual([]);
  });

  it("stays disabled and does not fetch without a session", () => {
    mockUseAuth.mockReturnValue({ session: null });

    const { result } = renderHook(() => useNoWorkDays("p1"), { wrapper });

    expect(apiNoWorkDays.listNoWorkDays).not.toHaveBeenCalled();
    expect(result.current.noWorkDays).toEqual([]);
  });
});
