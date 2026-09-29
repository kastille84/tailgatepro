import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useGcMeetings } from "../../src/hooks/useGcMeetings";
import * as apiGc from "../../src/services/apiGc";
import type { GcMeetingSummary } from "../../src/interfaces/gcDashboard";

vi.mock("../../src/services/apiGc");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const meeting: GcMeetingSummary = {
  id: "meeting-1",
  projectId: "project-1",
  projectName: "Downtown Tower",
  companyId: "sub-1",
  companyName: "Rivera Electric",
  talkTitle: "Fall Protection",
  heldAt: "2026-09-21T13:00:00.000Z",
  completedAt: "2026-09-21T13:05:00.000Z",
  signerCount: 3,
  pdfReady: true,
};

const secondMeeting: GcMeetingSummary = { ...meeting, id: "meeting-2" };

describe("useGcMeetings", () => {
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

  it("fetches the first page of meetings with the given filters", async () => {
    vi.mocked(apiGc.getGcMeetings).mockResolvedValue({
      meetings: [meeting],
      hasMore: false,
    });

    const { result } = renderHook(
      () => useGcMeetings({ projectId: "project-1" }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(apiGc.getGcMeetings).toHaveBeenCalledWith("token-123", {
      projectId: "project-1",
      limit: 20,
      offset: 0,
    });
    expect(result.current.meetings).toEqual([meeting]);
    expect(result.current.isError).toBe(false);
    expect(result.current.hasNextPage).toBe(false);
  });

  it("fetches and appends the next page when fetchNextPage is called", async () => {
    vi.mocked(apiGc.getGcMeetings)
      .mockResolvedValueOnce({ meetings: [meeting], hasMore: true })
      .mockResolvedValueOnce({ meetings: [secondMeeting], hasMore: false });

    const { result } = renderHook(() => useGcMeetings({ projectId: "project-1" }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    expect(result.current.meetings).toEqual([meeting]);

    await act(async () => {
      await result.current.fetchNextPage();
    });

    expect(apiGc.getGcMeetings).toHaveBeenLastCalledWith("token-123", {
      projectId: "project-1",
      limit: 20,
      offset: 20,
    });
    await waitFor(() =>
      expect(result.current.meetings).toEqual([meeting, secondMeeting]),
    );
    expect(result.current.hasNextPage).toBe(false);
  });

  it("defaults meetings to an empty array and reports the error on failure", async () => {
    vi.mocked(apiGc.getGcMeetings).mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useGcMeetings(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.meetings).toEqual([]);
    expect(result.current.hasNextPage).toBe(false);
  });

  it("is disabled (no fetch) without a session", () => {
    mockUseAuth.mockReturnValue({ session: null });

    const { result } = renderHook(() => useGcMeetings(), { wrapper });

    expect(apiGc.getGcMeetings).not.toHaveBeenCalled();
    expect(result.current.meetings).toEqual([]);
  });

  it("is disabled (no fetch) when the caller passes enabled: false", () => {
    const { result } = renderHook(() => useGcMeetings({}, false), { wrapper });

    expect(apiGc.getGcMeetings).not.toHaveBeenCalled();
    expect(result.current.meetings).toEqual([]);
  });
});
