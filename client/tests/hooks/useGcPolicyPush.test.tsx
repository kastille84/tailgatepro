import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useGcPolicyPush } from "../../src/hooks/useGcPolicyPush";
import * as apiGc from "../../src/services/apiGc";
import type { PolicyPushCompliance } from "../../src/interfaces/policyPush";

vi.mock("../../src/services/apiGc");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const compliance: PolicyPushCompliance = {
  talkId: "talk-1",
  talkTitle: "Fall Protection",
  pushedAt: "2026-09-01T00:00:00.000Z",
  pushedByName: "Jane Admin",
  jobsites: [],
  totals: { subs: 0, logged: 0, missing: 0 },
};

describe("useGcPolicyPush", () => {
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

  it("fetches the current policy push for the given date and tzOffset", async () => {
    vi.mocked(apiGc.getGcPolicyPush).mockResolvedValue(compliance);

    const { result } = renderHook(() => useGcPolicyPush("2026-09-21", 300), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(apiGc.getGcPolicyPush).toHaveBeenCalledWith("token-123", "2026-09-21", 300);
    expect(result.current.policyPush).toEqual(compliance);
    expect(result.current.isError).toBe(false);
  });

  it("defaults policyPush to null and reports the error on failure", async () => {
    vi.mocked(apiGc.getGcPolicyPush).mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useGcPolicyPush("2026-09-21", 300), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.policyPush).toBeNull();
  });

  it("is disabled (no fetch) without a session", () => {
    mockUseAuth.mockReturnValue({ session: null });

    const { result } = renderHook(() => useGcPolicyPush("2026-09-21", 300), { wrapper });

    expect(apiGc.getGcPolicyPush).not.toHaveBeenCalled();
    expect(result.current.policyPush).toBeNull();
  });

  it("reports isLoading true before the query resolves", () => {
    vi.mocked(apiGc.getGcPolicyPush).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useGcPolicyPush("2026-09-21", 300), { wrapper });

    expect(result.current.isLoading).toBe(true);
  });
});
