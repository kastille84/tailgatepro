import React from "react";
import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useVerifyGcMeetingSeal } from "../../src/hooks/useVerifyGcMeetingSeal";
import * as apiGc from "../../src/services/apiGc";

vi.mock("react-hot-toast");
vi.mock("../../src/services/apiGc");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("useVerifyGcMeetingSeal", () => {
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
    const { result } = renderHook(() => useVerifyGcMeetingSeal(), { wrapper });
    expect(result.current.isPending).toBe(false);
    expect(result.current.result).toBeUndefined();
    expect(result.current.verifyingId).toBeUndefined();
  });

  it("fetches the seal verification via the GC endpoint and exposes it under the meeting id it targeted", async () => {
    vi.mocked(apiGc.verifyGcMeetingSeal).mockResolvedValue({
      valid: false,
      sealedAt: "2026-09-21T13:05:00.000Z",
    });

    const { result } = renderHook(() => useVerifyGcMeetingSeal(), { wrapper });
    result.current.verifySeal("meeting-1");

    await waitFor(() =>
      expect(apiGc.verifyGcMeetingSeal).toHaveBeenCalledWith(
        "token-123",
        "meeting-1",
      ),
    );
    await waitFor(() =>
      expect(result.current.result).toEqual({
        valid: false,
        sealedAt: "2026-09-21T13:05:00.000Z",
      }),
    );
    expect(result.current.verifyingId).toBe("meeting-1");
  });

  it("runs immediately even when TanStack Query's onlineManager reports offline", async () => {
    onlineManager.setOnline(false);
    vi.mocked(apiGc.verifyGcMeetingSeal).mockResolvedValue({
      valid: true,
      sealedAt: "now",
    });

    const { result } = renderHook(() => useVerifyGcMeetingSeal(), { wrapper });
    result.current.verifySeal("meeting-1");

    await waitFor(() => expect(apiGc.verifyGcMeetingSeal).toHaveBeenCalled());
  });

  it("toasts the server message when the fetch fails", async () => {
    vi.mocked(apiGc.verifyGcMeetingSeal).mockRejectedValue(
      new Error("This meeting hasn't been sealed yet"),
    );

    const { result } = renderHook(() => useVerifyGcMeetingSeal(), { wrapper });
    result.current.verifySeal("meeting-1");

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "This meeting hasn't been sealed yet",
      ),
    );
    expect(result.current.isError).toBe(true);
  });
});
