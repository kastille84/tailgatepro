import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useClearPolicyPush } from "../../src/hooks/useClearPolicyPush";
import * as apiGc from "../../src/services/apiGc";

vi.mock("react-hot-toast");
vi.mock("../../src/services/apiGc");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("useClearPolicyPush", () => {
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

  it("initializes with isClearing false", () => {
    const { result } = renderHook(() => useClearPolicyPush(), { wrapper });
    expect(result.current.isClearing).toBe(false);
  });

  it("calls apiGc.clearGcPolicyPush with the session token", async () => {
    vi.mocked(apiGc.clearGcPolicyPush).mockResolvedValue(undefined);

    const { result } = renderHook(() => useClearPolicyPush(), { wrapper });
    await result.current.clearPush();

    expect(apiGc.clearGcPolicyPush).toHaveBeenCalledWith("token-123");
  });

  it("invalidates the gcPolicyPush query on success", async () => {
    vi.mocked(apiGc.clearGcPolicyPush).mockResolvedValue(undefined);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useClearPolicyPush(), { wrapper });
    await result.current.clearPush();

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["gcPolicyPush"] }),
    );
  });

  it("toasts and rejects when clearing fails", async () => {
    vi.mocked(apiGc.clearGcPolicyPush).mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useClearPolicyPush(), { wrapper });

    await expect(result.current.clearPush()).rejects.toThrow("boom");
    expect(toast.error).toHaveBeenCalledWith("boom");
  });
});
