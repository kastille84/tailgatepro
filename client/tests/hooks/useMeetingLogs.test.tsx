import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
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
    vi.mocked(apiMeetingLogs.getMeetingLogs).mockResolvedValue([meeting]);
    const range = {
      from: "2026-09-01T00:00:00.000Z",
      to: "2026-10-01T00:00:00.000Z",
    };

    const { result } = renderHook(() => useMeetingLogs(range), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(apiMeetingLogs.getMeetingLogs).toHaveBeenCalledWith(
      "token-123",
      range,
    );
    expect(result.current.meetings).toEqual([meeting]);
    expect(result.current.isError).toBe(false);
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
