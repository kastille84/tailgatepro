import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { usePublicSealStatus } from "../../src/hooks/usePublicSealStatus";
import * as apiPublicVerify from "../../src/services/apiPublicVerify";

vi.mock("../../src/services/apiPublicVerify");

describe("usePublicSealStatus", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("fetches the public seal status for the meeting id", async () => {
    const status = {
      sealed: true as const,
      valid: true,
      sealedAt: "2026-09-21T13:05:00.000Z",
      fileFingerprint: true,
      imageMismatchCount: 0,
    };
    vi.mocked(apiPublicVerify.getPublicSealStatus).mockResolvedValue(status);

    const { result } = renderHook(() => usePublicSealStatus("meeting-1"), { wrapper });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.status).toEqual(status));
    expect(apiPublicVerify.getPublicSealStatus).toHaveBeenCalledWith("meeting-1");
    expect(result.current.isLoading).toBe(false);
  });

  it("does not fetch without a meeting id", () => {
    const { result } = renderHook(() => usePublicSealStatus(undefined), { wrapper });

    expect(apiPublicVerify.getPublicSealStatus).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  it("exposes the error without retrying", async () => {
    vi.mocked(apiPublicVerify.getPublicSealStatus).mockRejectedValue(
      new Error("Meeting not found"),
    );

    const { result } = renderHook(() => usePublicSealStatus("meeting-1"), { wrapper });

    await waitFor(() => expect(result.current.error?.message).toBe("Meeting not found"));
    expect(apiPublicVerify.getPublicSealStatus).toHaveBeenCalledTimes(1);
  });
});
