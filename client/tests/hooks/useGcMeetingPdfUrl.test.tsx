import React from "react";
import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useGcMeetingPdfUrl } from "../../src/hooks/useGcMeetingPdfUrl";
import * as apiGc from "../../src/services/apiGc";

vi.mock("react-hot-toast");
vi.mock("../../src/services/apiGc");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("useGcMeetingPdfUrl", () => {
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
    const { result } = renderHook(() => useGcMeetingPdfUrl(), { wrapper });
    expect(result.current.isPending).toBe(false);
  });

  it("fetches the signed URL and opens it in a new tab on success", async () => {
    vi.mocked(apiGc.getGcMeetingPdfUrl).mockResolvedValue(
      "https://signed.example/meeting.pdf",
    );

    const { result } = renderHook(() => useGcMeetingPdfUrl(), { wrapper });
    result.current.openPdf("meeting-1");

    await waitFor(() =>
      expect(apiGc.getGcMeetingPdfUrl).toHaveBeenCalledWith(
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
    vi.mocked(apiGc.getGcMeetingPdfUrl).mockResolvedValue(
      "https://signed.example/meeting.pdf",
    );

    const { result } = renderHook(() => useGcMeetingPdfUrl(), { wrapper });
    result.current.openPdf("meeting-1");

    await waitFor(() => expect(apiGc.getGcMeetingPdfUrl).toHaveBeenCalled());
  });

  it("toasts the server message when the fetch fails", async () => {
    vi.mocked(apiGc.getGcMeetingPdfUrl).mockRejectedValue(
      new Error("No PDF has been generated for this meeting yet"),
    );

    const { result } = renderHook(() => useGcMeetingPdfUrl(), { wrapper });
    result.current.openPdf("meeting-1");

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "No PDF has been generated for this meeting yet",
      ),
    );
    expect(openSpy).not.toHaveBeenCalled();
  });
});
