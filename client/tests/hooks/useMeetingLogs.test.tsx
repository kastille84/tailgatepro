import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useMeetingLogs } from "../../src/hooks/useMeetingLogs";
import * as apiMeetingLogs from "../../src/services/apiMeetingLogs";
import type { MeetingLog } from "../../src/interfaces/meetingLog";

vi.mock("../../src/services/apiMeetingLogs");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const meeting: MeetingLog = {
  id: "meeting-1",
  projectId: "project-1",
  talkId: "talk-1",
  foremanId: "user-1",
  companyId: "company-1",
  crewPhotoUrl: null,
  finalPdfUrl: "meeting-1/report.pdf",
  completedAt: "2026-09-21T13:05:00.000Z",
  heldAt: "2026-09-21T13:00:00.000Z",
  syncedAt: null,
  createdAt: "2026-09-21T13:00:00.000Z",
};

describe("useMeetingLogs", () => {
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

  it("fetches the meetings for the given month range", async () => {
    vi.mocked(apiMeetingLogs.getMeetingLogs).mockResolvedValue({
      meetings: [meeting],
      nextCursor: null,
    });
    const range = {
      from: "2026-09-01T00:00:00.000Z",
      to: "2026-10-01T00:00:00.000Z",
    };

    const { result } = renderHook(() => useMeetingLogs(range), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(apiMeetingLogs.getMeetingLogs).toHaveBeenCalledWith(
      "token-123",
      range,
      { limit: 50, cursor: undefined },
    );
    expect(result.current.meetings).toEqual([meeting]);
    expect(result.current.isError).toBe(false);
    expect(result.current.hasNextPage).toBe(false);
  });

  it("loads the next page with the previous page's cursor and appends it", async () => {
    const second: MeetingLog = { ...meeting, id: "meeting-2" };
    vi.mocked(apiMeetingLogs.getMeetingLogs)
      .mockResolvedValueOnce({ meetings: [meeting], nextCursor: "cursor-1" })
      .mockResolvedValueOnce({ meetings: [second], nextCursor: null });

    const { result } = renderHook(() => useMeetingLogs(), { wrapper });

    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    expect(result.current.meetings).toEqual([meeting]);

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.meetings).toEqual([meeting, second]));
    expect(apiMeetingLogs.getMeetingLogs).toHaveBeenLastCalledWith(
      "token-123",
      {},
      { limit: 50, cursor: "cursor-1" },
    );
    expect(result.current.hasNextPage).toBe(false);
    expect(result.current.isFetchingNextPage).toBe(false);
  });

  it("defaults to no meetings and reports the error on failure", async () => {
    vi.mocked(apiMeetingLogs.getMeetingLogs).mockRejectedValue(
      new Error("boom"),
    );

    const { result } = renderHook(() => useMeetingLogs(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.meetings).toEqual([]);
  });

  it("is disabled (no fetch) without a session", () => {
    mockUseAuth.mockReturnValue({ session: null });

    const { result } = renderHook(() => useMeetingLogs(), { wrapper });

    expect(apiMeetingLogs.getMeetingLogs).not.toHaveBeenCalled();
    expect(result.current.meetings).toEqual([]);
  });

  it("is disabled (no fetch) when the caller passes enabled: false", () => {
    const { result } = renderHook(() => useMeetingLogs({}, false), { wrapper });

    expect(apiMeetingLogs.getMeetingLogs).not.toHaveBeenCalled();
    expect(result.current.meetings).toEqual([]);
  });
});
