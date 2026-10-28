import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

import { useVerifyPdfFile } from "../../src/hooks/useVerifyPdfFile";
import * as apiPublicVerify from "../../src/services/apiPublicVerify";
import * as sha256FileModule from "../../src/utils/sha256File";

vi.mock("../../src/services/apiPublicVerify");
vi.mock("../../src/utils/sha256File");

describe("useVerifyPdfFile", () => {
  let queryClient: QueryClient;
  const file = new File(["%PDF"], "report.pdf", { type: "application/pdf" });

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    vi.clearAllMocks();
    vi.mocked(sha256FileModule.sha256File).mockResolvedValue("a".repeat(64));
  });

  afterEach(() => {
    onlineManager.setOnline(true);
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("starts idle", () => {
    const { result } = renderHook(() => useVerifyPdfFile("meeting-1"), { wrapper });

    expect(result.current.isPending).toBe(false);
    expect(result.current.result).toBeUndefined();
    expect(result.current.error).toBeNull();
  });

  it("hashes the file in the browser and sends only the digest", async () => {
    vi.mocked(apiPublicVerify.checkPublicPdfHash).mockResolvedValue({
      matches: true,
      status: "current",
    });

    const { result } = renderHook(() => useVerifyPdfFile("meeting-1"), { wrapper });
    result.current.checkFile(file);

    await waitFor(() =>
      expect(result.current.result).toEqual({ matches: true, status: "current" }),
    );
    expect(sha256FileModule.sha256File).toHaveBeenCalledWith(file);
    expect(apiPublicVerify.checkPublicPdfHash).toHaveBeenCalledWith(
      "meeting-1",
      "a".repeat(64),
    );
  });

  it("runs even when TanStack Query's onlineManager reports offline", async () => {
    onlineManager.setOnline(false);
    vi.mocked(apiPublicVerify.checkPublicPdfHash).mockResolvedValue({
      matches: false,
      status: "no-match",
    });

    const { result } = renderHook(() => useVerifyPdfFile("meeting-1"), { wrapper });
    result.current.checkFile(file);

    await waitFor(() => expect(apiPublicVerify.checkPublicPdfHash).toHaveBeenCalled());
  });

  it("exposes the error when the check fails", async () => {
    vi.mocked(apiPublicVerify.checkPublicPdfHash).mockRejectedValue(
      new Error("No file fingerprint is on record for this report"),
    );

    const { result } = renderHook(() => useVerifyPdfFile("meeting-1"), { wrapper });
    result.current.checkFile(file);

    await waitFor(() =>
      expect(result.current.error?.message).toBe(
        "No file fingerprint is on record for this report",
      ),
    );
  });
});
