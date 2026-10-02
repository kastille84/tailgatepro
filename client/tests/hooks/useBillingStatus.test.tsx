import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useBillingStatus } from "../../src/hooks/useBillingStatus";
import * as apiStripe from "../../src/services/apiStripe";

vi.mock("../../src/services/apiStripe");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockUseCurrentUser = vi.fn();
vi.mock("../../src/hooks/useCurrentUser", () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));

const summary = {
  hasBillingAccount: true,
  subscriptionStatus: "active",
  billingInterval: "monthly" as const,
  currentPeriodEnd: "2027-01-01T00:00:00.000Z",
};

describe("useBillingStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ session: { access_token: "token-123" } });
    mockUseCurrentUser.mockReturnValue({ isManagerRole: true });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {children}
    </QueryClientProvider>
  );

  it("fetches the billing summary for a manager", async () => {
    vi.mocked(apiStripe.getBillingSummary).mockResolvedValue(summary);

    const { result } = renderHook(() => useBillingStatus(), { wrapper });

    await waitFor(() => expect(result.current.billing).toEqual(summary));
    expect(apiStripe.getBillingSummary).toHaveBeenCalledWith("token-123");
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it("refetches on an interval while polling", async () => {
    vi.mocked(apiStripe.getBillingSummary).mockResolvedValue(summary);

    renderHook(() => useBillingStatus({ poll: true }), { wrapper });

    await waitFor(
      () => expect(apiStripe.getBillingSummary).toHaveBeenCalledTimes(2),
      { timeout: 5000 },
    );
  });

  it("reports isError when the fetch fails", async () => {
    vi.mocked(apiStripe.getBillingSummary).mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useBillingStatus(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.billing).toBeNull();
  });

  it("does not fetch for a non-manager (the endpoint would 403)", () => {
    mockUseCurrentUser.mockReturnValue({ isManagerRole: false });

    const { result } = renderHook(() => useBillingStatus(), { wrapper });

    expect(apiStripe.getBillingSummary).not.toHaveBeenCalled();
    expect(result.current.billing).toBeNull();
  });

  it("does not fetch without a session", () => {
    mockUseAuth.mockReturnValue({ session: null });

    renderHook(() => useBillingStatus(), { wrapper });

    expect(apiStripe.getBillingSummary).not.toHaveBeenCalled();
  });
});
