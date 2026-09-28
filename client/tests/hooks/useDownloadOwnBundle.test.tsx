import React from "react";
import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useDownloadOwnBundle } from "../../src/hooks/useDownloadOwnBundle";
import * as apiMeetingLogs from "../../src/services/apiMeetingLogs";
import * as downloadUtils from "../../src/utils/triggerBrowserDownload";

vi.mock("react-hot-toast");
vi.mock("../../src/services/apiMeetingLogs");
vi.mock("../../src/utils/triggerBrowserDownload");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("useDownloadOwnBundle", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
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

  it("initializes with nothing in flight", () => {
    const { result } = renderHook(() => useDownloadOwnBundle(), { wrapper });
    expect(result.current.isPending).toBe(false);
  });

  it("fetches the bundle and triggers a browser download on success", async () => {
    const blob = new Blob(["zip bytes"]);
    vi.mocked(apiMeetingLogs.getDefenseBundle).mockResolvedValue({
      blob,
      filename: "acme-roofing-defense-bundle.zip",
    });

    const { result } = renderHook(() => useDownloadOwnBundle(), { wrapper });
    result.current.downloadBundle();

    await waitFor(() =>
      expect(apiMeetingLogs.getDefenseBundle).toHaveBeenCalledWith("token-123"),
    );
    await waitFor(() =>
      expect(downloadUtils.triggerBrowserDownload).toHaveBeenCalledWith(
        blob,
        "acme-roofing-defense-bundle.zip",
      ),
    );
  });

  it("runs immediately even when TanStack Query's onlineManager reports offline", async () => {
    onlineManager.setOnline(false);
    vi.mocked(apiMeetingLogs.getDefenseBundle).mockResolvedValue({
      blob: new Blob(["zip bytes"]),
      filename: "bundle.zip",
    });

    const { result } = renderHook(() => useDownloadOwnBundle(), { wrapper });
    result.current.downloadBundle();

    await waitFor(() => expect(apiMeetingLogs.getDefenseBundle).toHaveBeenCalled());
  });

  it("toasts the server message and never downloads when the fetch fails", async () => {
    vi.mocked(apiMeetingLogs.getDefenseBundle).mockRejectedValue(
      new Error("Upgrade to Trade Pro to download your OSHA Defense Bundle"),
    );

    const { result } = renderHook(() => useDownloadOwnBundle(), { wrapper });
    result.current.downloadBundle();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Upgrade to Trade Pro to download your OSHA Defense Bundle",
      ),
    );
    expect(downloadUtils.triggerBrowserDownload).not.toHaveBeenCalled();
  });
});
