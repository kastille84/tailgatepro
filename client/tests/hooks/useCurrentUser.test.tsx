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

const LIMITS = {
  planId: "trade-free",
  foremanSeats: 1,
  activeJobsites: null,
  unlockedSubs: null,
  historyDays: 30,
  archiveYears: 0,
  libraryAccess: "core" as const,
};

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
      plan: "trade-free",
      limits: LIMITS,
      hasBrandingAccess: true,
    });

    const { result } = renderHook(() => useCurrentUser(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(apiUsers.getCurrentUser).toHaveBeenCalledWith("token-123");
    expect(result.current.tier).toBe("premium");
    expect(result.current.hasTranslationAccess).toBe(true);
    expect(result.current.hasBrandingAccess).toBe(true);
    expect(result.current.plan).toBe("trade-free");
    expect(result.current.limits).toEqual(LIMITS);
  });

  it("reports hasTranslationAccess true for enterprise tier", async () => {
    vi.mocked(apiUsers.getCurrentUser).mockResolvedValue({
      id: "user-1",
      companyId: "company-1",
      role: "foreman",
      tier: "enterprise",
      companyType: "subcontractor",
      plan: "trade-free",
      limits: LIMITS,
      hasBrandingAccess: true,
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
      plan: "trade-free",
      limits: LIMITS,
      hasBrandingAccess: false,
    });

    const { result } = renderHook(() => useCurrentUser(), { wrapper });

    await waitFor(() => expect(result.current.tier).toBe("basic"));
    expect(result.current.hasTranslationAccess).toBe(false);
    expect(result.current.hasBrandingAccess).toBe(false);
  });

  it("reports hasBrandingAccess true for a GC Free company with a Site Pro jobsite (server-resolved, not tier-derived)", async () => {
    vi.mocked(apiUsers.getCurrentUser).mockResolvedValue({
      id: "user-1",
      companyId: "company-1",
      role: "admin",
      tier: "basic",
      companyType: "gc",
      plan: "gc-free",
      limits: LIMITS,
      hasBrandingAccess: true,
    });

    const { result } = renderHook(() => useCurrentUser(), { wrapper });

    await waitFor(() => expect(result.current.plan).toBe("gc-free"));
    expect(result.current.hasBrandingAccess).toBe(true);
  });

  it("exposes role, companyId and companyType, flagging a subcontractor company", async () => {
    vi.mocked(apiUsers.getCurrentUser).mockResolvedValue({
      id: "user-1",
      companyId: "company-1",
      role: "foreman",
      tier: "basic",
      companyType: "subcontractor",
      plan: "trade-free",
      limits: LIMITS,
      hasBrandingAccess: false,
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
      plan: "trade-free",
      limits: LIMITS,
      hasBrandingAccess: false,
    });

    const { result } = renderHook(() => useCurrentUser(), { wrapper });

    await waitFor(() => expect(result.current.companyType).toBe("gc"));
    expect(result.current.isGc).toBe(true);
    expect(result.current.isSubcontractor).toBe(false);
  });

  it("lets a subcontractor and a GC Portfolio company author company talks, but not a GC Free company", async () => {
    const profile = {
      id: "user-3",
      companyId: "company-3",
      role: "admin" as const,
      tier: "premium" as const,
      limits: LIMITS,
    };

    vi.mocked(apiUsers.getCurrentUser).mockResolvedValue({
      ...profile,
      companyType: "subcontractor",
      plan: "trade-free",
      hasBrandingAccess: true,
    });
    const sub = renderHook(() => useCurrentUser(), { wrapper });
    await waitFor(() => expect(sub.result.current.companyType).toBe("subcontractor"));
    expect(sub.result.current.canAuthorCompanyTalks).toBe(true);

    vi.mocked(apiUsers.getCurrentUser).mockResolvedValue({
      ...profile,
      companyType: "gc",
      plan: "gc-portfolio",
      hasBrandingAccess: true,
    });
    queryClient.clear();
    const portfolio = renderHook(() => useCurrentUser(), { wrapper });
    await waitFor(() => expect(portfolio.result.current.plan).toBe("gc-portfolio"));
    expect(portfolio.result.current.canAuthorCompanyTalks).toBe(true);

    vi.mocked(apiUsers.getCurrentUser).mockResolvedValue({
      ...profile,
      tier: "basic",
      companyType: "gc",
      plan: "gc-free",
      hasBrandingAccess: false,
    });
    queryClient.clear();
    const free = renderHook(() => useCurrentUser(), { wrapper });
    await waitFor(() => expect(free.result.current.plan).toBe("gc-free"));
    expect(free.result.current.canAuthorCompanyTalks).toBe(false);
  });

  it.each([
    ["admin", true],
    ["safety_manager", true],
    ["foreman", false],
    ["superintendent", false],
  ])("reports isManagerRole for role %s -> %s", async (role, expected) => {
    vi.mocked(apiUsers.getCurrentUser).mockResolvedValue({
      id: "user-4",
      companyId: "company-4",
      role,
      tier: "premium",
      companyType: "gc",
      plan: "gc-portfolio",
      limits: LIMITS,
      hasBrandingAccess: true,
    });

    const { result } = renderHook(() => useCurrentUser(), { wrapper });

    await waitFor(() => expect(result.current.role).toBe(role));
    expect(result.current.isManagerRole).toBe(expected);
  });

  it.each([
    ["trade-free", false],
    ["trade-pro", true],
    ["trade-enterprise", true],
    ["gc-free", false],
    ["gc-site-pro", false],
    ["gc-portfolio", true],
  ])("reports hasAiTalkBuilderAccess for plan %s -> %s", async (plan, expected) => {
    vi.mocked(apiUsers.getCurrentUser).mockResolvedValue({
      id: "user-1",
      companyId: "company-1",
      role: "admin",
      tier: "premium",
      companyType: "subcontractor",
      plan,
      limits: LIMITS,
      hasBrandingAccess: false,
    });

    const { result } = renderHook(() => useCurrentUser(), { wrapper });

    await waitFor(() => expect(result.current.plan).toBe(plan));
    expect(result.current.hasAiTalkBuilderAccess).toBe(expected);
  });

  it("defaults tier to null and hasTranslationAccess/hasBrandingAccess to false before the query resolves / without a session", () => {
    mockUseAuth.mockReturnValue({ session: null });

    const { result } = renderHook(() => useCurrentUser(), { wrapper });

    expect(apiUsers.getCurrentUser).not.toHaveBeenCalled();
    expect(result.current.tier).toBeNull();
    expect(result.current.hasTranslationAccess).toBe(false);
    expect(result.current.hasBrandingAccess).toBe(false);
    expect(result.current.hasAiTalkBuilderAccess).toBe(false);
    expect(result.current.role).toBeNull();
    expect(result.current.companyId).toBeNull();
    expect(result.current.companyType).toBeNull();
    expect(result.current.plan).toBeNull();
    expect(result.current.limits).toBeNull();
    expect(result.current.isGc).toBe(false);
    expect(result.current.isSubcontractor).toBe(false);
    // Permissive while the profile is unknown -- the server is the authority.
    expect(result.current.canAuthorCompanyTalks).toBe(true);
    expect(result.current.isManagerRole).toBe(false);
  });
});
