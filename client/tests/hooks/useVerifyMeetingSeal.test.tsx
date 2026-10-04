import React from "react";
import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useVerifyMeetingSeal } from "../../src/hooks/useVerifyMeetingSeal";
import * as apiMeetingLogs from "../../src/services/apiMeetingLogs";

vi.mock("react-hot-toast");
vi.mock("../../src/services/apiMeetingLogs");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("useVerifyMeetingSeal", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ session: { access_token: "token-123" } });
  });

  afterEach(() => {
    onlineManager.setOnline(true);
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("initializes with nothing in flight and no target meeting", () => {
    const { result } = renderHook(() => useVerifyMeetingSeal(), { wrapper });
    expect(result.current.isPending).toBe(false);
    expect(result.current.result).toBeUndefined();
    expect(result.current.verifyingId).toBeUndefined();
  });

  it("fetches the seal verification and exposes it under the meeting id it targeted", async () => {
    vi.mocked(apiMeetingLogs.verifyMeetingSeal).mockResolvedValue({
      valid: true,
      sealedAt: "2026-09-21T06:00:00.000Z",
    });

    const { result } = renderHook(() => useVerifyMeetingSeal(), { wrapper });
    result.current.verifySeal("meeting-1");

    await waitFor(() =>
      expect(apiMeetingLogs.verifyMeetingSeal).toHaveBeenCalledWith(
        "token-123",
        "meeting-1",
      ),
    );
    await waitFor(() =>
      expect(result.current.result).toEqual({
        valid: true,
        sealedAt: "2026-09-21T06:00:00.000Z",
      }),
    );
    expect(result.current.verifyingId).toBe("meeting-1");
  });

  it("runs immediately even when TanStack Query's onlineManager reports offline", async () => {
    onlineManager.setOnline(false);
    vi.mocked(apiMeetingLogs.verifyMeetingSeal).mockResolvedValue({
      valid: true,
      sealedAt: "now",
    });

    const { result } = renderHook(() => useVerifyMeetingSeal(), { wrapper });
    result.current.verifySeal("meeting-1");

    await waitFor(() =>
      expect(apiMeetingLogs.verifyMeetingSeal).toHaveBeenCalled(),
    );
  });

  it("toasts the server message when the fetch fails", async () => {
    vi.mocked(apiMeetingLogs.verifyMeetingSeal).mockRejectedValue(
      new Error("This meeting hasn't been sealed yet"),
    );

    const { result } = renderHook(() => useVerifyMeetingSeal(), { wrapper });
    result.current.verifySeal("meeting-1");

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "This meeting hasn't been sealed yet",
      ),
    );
    expect(result.current.isError).toBe(true);
  });
});
