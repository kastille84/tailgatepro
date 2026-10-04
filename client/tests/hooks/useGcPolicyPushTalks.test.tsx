import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useGcPolicyPushTalks } from "../../src/hooks/useGcPolicyPushTalks";
import * as apiGc from "../../src/services/apiGc";
import type { PolicyPushTalkOption } from "../../src/interfaces/policyPush";

vi.mock("../../src/services/apiGc");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const talks: PolicyPushTalkOption[] = [
  { id: "talk-1", title: "Fall Protection", tradeTag: null },
];

describe("useGcPolicyPushTalks", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ session: { access_token: "token-123" } });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("fetches the picker's talk list when enabled", async () => {
    vi.mocked(apiGc.getGcPolicyPushTalks).mockResolvedValue(talks);

    const { result } = renderHook(() => useGcPolicyPushTalks(true), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(apiGc.getGcPolicyPushTalks).toHaveBeenCalledWith("token-123");
    expect(result.current.talks).toEqual(talks);
    expect(result.current.isError).toBe(false);
  });

  it("defaults talks to an empty array on failure", async () => {
    vi.mocked(apiGc.getGcPolicyPushTalks).mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useGcPolicyPushTalks(true), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.talks).toEqual([]);
  });

  it("is disabled (no fetch) without a session", () => {
    mockUseAuth.mockReturnValue({ session: null });

    const { result } = renderHook(() => useGcPolicyPushTalks(true), { wrapper });

    expect(apiGc.getGcPolicyPushTalks).not.toHaveBeenCalled();
    expect(result.current.talks).toEqual([]);
  });

  it("is disabled (no fetch) when isEnabled is false", () => {
    const { result } = renderHook(() => useGcPolicyPushTalks(false), { wrapper });

    expect(apiGc.getGcPolicyPushTalks).not.toHaveBeenCalled();
    expect(result.current.talks).toEqual([]);
  });
});
