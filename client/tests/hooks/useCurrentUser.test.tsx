import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useCurrentUser } from "../../src/hooks/useCurrentUser";
import * as apiUsers from "../../src/services/apiUsers";

vi.mock("../../src/services/apiUsers");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("useCurrentUser", () => {
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

  it("fetches the current user with the session token and exposes the tier", async () => {
    vi.mocked(apiUsers.getCurrentUser).mockResolvedValue({
      id: "user-1",
      companyId: "company-1",
      role: "foreman",
      tier: "premium",
      companyType: "subcontractor",
    });

    const { result } = renderHook(() => useCurrentUser(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(apiUsers.getCurrentUser).toHaveBeenCalledWith("token-123");
    expect(result.current.tier).toBe("premium");
    expect(result.current.hasTranslationAccess).toBe(true);
    expect(result.current.hasBrandingAccess).toBe(true);
  });

  it("reports hasTranslationAccess true for enterprise tier", async () => {
    vi.mocked(apiUsers.getCurrentUser).mockResolvedValue({
      id: "user-1",
      companyId: "company-1",
      role: "foreman",
      tier: "enterprise",
      companyType: "subcontractor",
    });

    const { result } = renderHook(() => useCurrentUser(), { wrapper });

    await waitFor(() => expect(result.current.tier).toBe("enterprise"));
    expect(result.current.hasTranslationAccess).toBe(true);
    expect(result.current.hasBrandingAccess).toBe(true);
  });

  it("reports hasTranslationAccess false for basic tier", async () => {
    vi.mocked(apiUsers.getCurrentUser).mockResolvedValue({
      id: "user-1",
      companyId: "company-1",
      role: "foreman",
      tier: "basic",
      companyType: "subcontractor",
    });

    const { result } = renderHook(() => useCurrentUser(), { wrapper });

    await waitFor(() => expect(result.current.tier).toBe("basic"));
    expect(result.current.hasTranslationAccess).toBe(false);
    expect(result.current.hasBrandingAccess).toBe(false);
  });

  it("exposes role, companyId and companyType, flagging a subcontractor company", async () => {
    vi.mocked(apiUsers.getCurrentUser).mockResolvedValue({
      id: "user-1",
      companyId: "company-1",
      role: "foreman",
      tier: "basic",
      companyType: "subcontractor",
    });

    const { result } = renderHook(() => useCurrentUser(), { wrapper });

    await waitFor(() => expect(result.current.companyType).toBe("subcontractor"));
    expect(result.current.role).toBe("foreman");
    expect(result.current.companyId).toBe("company-1");
    expect(result.current.isSubcontractor).toBe(true);
    expect(result.current.isGc).toBe(false);
  });

  it("flags a GC company", async () => {
    vi.mocked(apiUsers.getCurrentUser).mockResolvedValue({
      id: "user-2",
      companyId: "company-2",
      role: "admin",
      tier: "basic",
      companyType: "gc",
    });

    const { result } = renderHook(() => useCurrentUser(), { wrapper });

    await waitFor(() => expect(result.current.companyType).toBe("gc"));
    expect(result.current.isGc).toBe(true);
    expect(result.current.isSubcontractor).toBe(false);
  });

  it("defaults tier to null and hasTranslationAccess/hasBrandingAccess to false before the query resolves / without a session", () => {
    mockUseAuth.mockReturnValue({ session: null });

    const { result } = renderHook(() => useCurrentUser(), { wrapper });

    expect(apiUsers.getCurrentUser).not.toHaveBeenCalled();
    expect(result.current.tier).toBeNull();
    expect(result.current.hasTranslationAccess).toBe(false);
    expect(result.current.hasBrandingAccess).toBe(false);
    expect(result.current.role).toBeNull();
    expect(result.current.companyId).toBeNull();
    expect(result.current.companyType).toBeNull();
    expect(result.current.isGc).toBe(false);
    expect(result.current.isSubcontractor).toBe(false);
  });
});
