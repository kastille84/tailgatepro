import React from "react";
import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useMeetingPdfUrl } from "../../src/hooks/useMeetingPdfUrl";
import * as apiMeetingLogs from "../../src/services/apiMeetingLogs";

vi.mock("react-hot-toast");
vi.mock("../../src/services/apiMeetingLogs");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("useMeetingPdfUrl", () => {
  let queryClient: QueryClient;
  let openSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ session: { access_token: "token-123" } });
    openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
  });

  afterEach(() => {
    onlineManager.setOnline(true);
    openSpy.mockRestore();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("initializes with nothing in flight", () => {
    const { result } = renderHook(() => useMeetingPdfUrl(), { wrapper });
    expect(result.current.isPending).toBe(false);
  });

  it("fetches the signed URL and opens it in a new tab on success", async () => {
    vi.mocked(apiMeetingLogs.getMeetingPdfUrl).mockResolvedValue(
      "https://signed.example/meeting.pdf",
    );

    const { result } = renderHook(() => useMeetingPdfUrl(), { wrapper });
    result.current.openPdf("meeting-1");

    await waitFor(() =>
      expect(apiMeetingLogs.getMeetingPdfUrl).toHaveBeenCalledWith(
        "token-123",
        "meeting-1",
      ),
    );
    await waitFor(() =>
      expect(openSpy).toHaveBeenCalledWith(
        "https://signed.example/meeting.pdf",
        "_blank",
      ),
    );
  });

  it("runs immediately even when TanStack Query's onlineManager reports offline", async () => {
    onlineManager.setOnline(false);
    vi.mocked(apiMeetingLogs.getMeetingPdfUrl).mockResolvedValue(
      "https://signed.example/meeting.pdf",
    );

    const { result } = renderHook(() => useMeetingPdfUrl(), { wrapper });
    result.current.openPdf("meeting-1");

    await waitFor(() =>
      expect(apiMeetingLogs.getMeetingPdfUrl).toHaveBeenCalled(),
    );
  });

  it("toasts the server message when the fetch fails", async () => {
    vi.mocked(apiMeetingLogs.getMeetingPdfUrl).mockRejectedValue(
      new Error("This meeting is older than your plan's history. Upgrade to view it."),
    );

    const { result } = renderHook(() => useMeetingPdfUrl(), { wrapper });
    result.current.openPdf("meeting-1");

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "This meeting is older than your plan's history. Upgrade to view it.",
      ),
    );
    expect(openSpy).not.toHaveBeenCalled();
  });
});
