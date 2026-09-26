import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useMeetingMonths } from "../../src/hooks/useMeetingMonths";
import * as apiMeetingLogs from "../../src/services/apiMeetingLogs";

vi.mock("../../src/services/apiMeetingLogs");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("useMeetingMonths", () => {
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

  it("fetches the months with the viewer's timezone offset and exposes the history meta", async () => {
    vi.mocked(apiMeetingLogs.getMeetingMonths).mockResolvedValue({
      months: [{ month: "2026-09", count: 4 }],
      hiddenCount: 2,
      historyDays: 30,
    });

    const { result } = renderHook(() => useMeetingMonths(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(apiMeetingLogs.getMeetingMonths).toHaveBeenCalledWith(
      "token-123",
      new Date().getTimezoneOffset(),
    );
    expect(result.current.months).toEqual([{ month: "2026-09", count: 4 }]);
    expect(result.current.hiddenCount).toBe(2);
    expect(result.current.historyDays).toBe(30);
    expect(result.current.isError).toBe(false);
  });

  it("defaults to no months, nothing hidden and no window on failure", async () => {
    vi.mocked(apiMeetingLogs.getMeetingMonths).mockRejectedValue(
      new Error("boom"),
    );

    const { result } = renderHook(() => useMeetingMonths(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.months).toEqual([]);
    expect(result.current.hiddenCount).toBe(0);
    expect(result.current.historyDays).toBeNull();
  });

  it("is disabled (no fetch) without a session", () => {
    mockUseAuth.mockReturnValue({ session: null });

    const { result } = renderHook(() => useMeetingMonths(), { wrapper });

    expect(apiMeetingLogs.getMeetingMonths).not.toHaveBeenCalled();
    expect(result.current.months).toEqual([]);
  });
});
