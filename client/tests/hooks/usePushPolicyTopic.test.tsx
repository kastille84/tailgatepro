import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { usePushPolicyTopic } from "../../src/hooks/usePushPolicyTopic";
import * as apiGc from "../../src/services/apiGc";

vi.mock("react-hot-toast");
vi.mock("../../src/services/apiGc");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const pushed = {
  talkId: "talk-1",
  talkTitle: "Fall Protection",
  pushedAt: "2026-09-21T00:00:00.000Z",
  pushedByName: "Jane Admin",
};

describe("usePushPolicyTopic", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ session: { access_token: "token-123" } });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("initializes with isPushing false", () => {
    const { result } = renderHook(() => usePushPolicyTopic(), { wrapper });
    expect(result.current.isPushing).toBe(false);
  });

  it("calls apiGc.pushGcPolicyTopic with the session token and talkId", async () => {
    vi.mocked(apiGc.pushGcPolicyTopic).mockResolvedValue(pushed);

    const { result } = renderHook(() => usePushPolicyTopic(), { wrapper });
    await result.current.pushTopic("talk-1");

    expect(apiGc.pushGcPolicyTopic).toHaveBeenCalledWith("token-123", "talk-1");
  });

  it("invalidates the gcPolicyPush query on success", async () => {
    vi.mocked(apiGc.pushGcPolicyTopic).mockResolvedValue(pushed);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => usePushPolicyTopic(), { wrapper });
    await result.current.pushTopic("talk-1");

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["gcPolicyPush"] }),
    );
  });

  it("toasts and rejects when the push fails", async () => {
    vi.mocked(apiGc.pushGcPolicyTopic).mockRejectedValue(new Error("Talk not found"));

    const { result } = renderHook(() => usePushPolicyTopic(), { wrapper });

    await expect(result.current.pushTopic("talk-1")).rejects.toThrow("Talk not found");
    expect(toast.error).toHaveBeenCalledWith("Talk not found");
  });
});
