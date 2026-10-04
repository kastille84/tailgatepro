import React from "react";
import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useDownloadDefenseBundle } from "../../src/hooks/useDownloadDefenseBundle";
import * as apiGc from "../../src/services/apiGc";
import * as downloadUtils from "../../src/utils/triggerBrowserDownload";
import type { Jobsite } from "../../src/interfaces/jobsite";

vi.mock("react-hot-toast");
vi.mock("../../src/services/apiGc");
vi.mock("../../src/utils/triggerBrowserDownload");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const jobsite: Jobsite = {
  id: "jobsite-1",
  gcCompanyId: "gc-1",
  name: "Riverside Tower",
  status: "active",
  archivedAt: null,
  createdBySub: false,
  plan: "site_pro",
  createdAt: "2026-01-01T00:00:00.000Z",
  subcontractors: [],
};

describe("useDownloadDefenseBundle", () => {
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
    const { result } = renderHook(() => useDownloadDefenseBundle(), { wrapper });
    expect(result.current.isPending).toBe(false);
  });

  it("fetches the bundle and triggers a browser download on success", async () => {
    const blob = new Blob(["zip bytes"]);
    vi.mocked(apiGc.getDefenseBundle).mockResolvedValue({
      blob,
      filename: "riverside-tower-defense-bundle.zip",
    });

    const { result } = renderHook(() => useDownloadDefenseBundle(), { wrapper });
    result.current.downloadBundle(jobsite);

    await waitFor(() =>
      expect(apiGc.getDefenseBundle).toHaveBeenCalledWith("token-123", "jobsite-1"),
    );
    await waitFor(() =>
      expect(downloadUtils.triggerBrowserDownload).toHaveBeenCalledWith(
        blob,
        "riverside-tower-defense-bundle.zip",
      ),
    );
  });

  it("runs immediately even when TanStack Query's onlineManager reports offline", async () => {
    onlineManager.setOnline(false);
    vi.mocked(apiGc.getDefenseBundle).mockResolvedValue({
      blob: new Blob(["zip bytes"]),
      filename: "bundle.zip",
    });

    const { result } = renderHook(() => useDownloadDefenseBundle(), { wrapper });
    result.current.downloadBundle(jobsite);

    await waitFor(() => expect(apiGc.getDefenseBundle).toHaveBeenCalled());
  });

  it("toasts the server message and never downloads when the fetch fails", async () => {
    vi.mocked(apiGc.getDefenseBundle).mockRejectedValue(
      new Error("Upgrade this job site to Site Pro to download its OSHA Defense Bundle"),
    );

    const { result } = renderHook(() => useDownloadDefenseBundle(), { wrapper });
    result.current.downloadBundle(jobsite);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Upgrade this job site to Site Pro to download its OSHA Defense Bundle",
      ),
    );
    expect(downloadUtils.triggerBrowserDownload).not.toHaveBeenCalled();
  });
});
