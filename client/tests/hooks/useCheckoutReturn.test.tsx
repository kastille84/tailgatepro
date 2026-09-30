import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import toast from "react-hot-toast";

import {
  CHECKOUT_CONFIRM_TIMEOUT_MS,
  useCheckoutReturn,
} from "../../src/hooks/useCheckoutReturn";

vi.mock("react-hot-toast", () => {
  const toastFn = Object.assign(vi.fn(), { success: vi.fn() });
  return { default: toastFn };
});

const mockUseBillingStatus = vi.fn();
vi.mock("../../src/hooks/useBillingStatus", () => ({
  useBillingStatus: (options: unknown) => mockUseBillingStatus(options),
}));

const Probe = () => {
  const { isConfirming } = useCheckoutReturn();
  const location = useLocation();
  return (
    <div>
      <span data-testid="confirming">{String(isConfirming)}</span>
      <span data-testid="search">{location.search}</span>
    </div>
  );
};

describe("useCheckoutReturn", () => {
  let queryClient: QueryClient;
  let invalidateSpy: ReturnType<typeof vi.spyOn>;

  const renderAt = (route: string) =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>
          <Probe />
        </MemoryRouter>
      </QueryClientProvider>,
    );

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient();
    invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    mockUseBillingStatus.mockReturnValue({ billing: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does nothing on a normal visit to Settings", () => {
    renderAt("/settings");

    expect(screen.getByTestId("confirming").textContent).toBe("false");
    expect(mockUseBillingStatus).toHaveBeenCalledWith({ poll: false });
    expect(toast).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("says nothing was charged on cancel and clears the param", () => {
    renderAt("/settings?checkout=cancel&keep=1");

    expect(toast).toHaveBeenCalledWith("Checkout canceled. You haven't been charged.");
    expect(screen.getByTestId("search").textContent).toBe("?keep=1");
  });

  it("polls while confirming a successful checkout", () => {
    renderAt("/settings?checkout=success");

    expect(screen.getByTestId("confirming").textContent).toBe("true");
    expect(mockUseBillingStatus).toHaveBeenCalledWith({ poll: true });
    expect(toast.success).not.toHaveBeenCalled();
  });

  it.each(["active", "trialing"])(
    "confirms, refreshes the current user and clears the param once the subscription is %s",
    (subscriptionStatus) => {
      mockUseBillingStatus.mockReturnValue({ billing: { subscriptionStatus } });

      renderAt("/settings?checkout=success");

      expect(toast.success).toHaveBeenCalledWith(
        "Your plan is active. Thanks for subscribing!",
      );
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["currentUser"] });
      expect(screen.getByTestId("search").textContent).toBe("");
      expect(screen.getByTestId("confirming").textContent).toBe("false");
    },
  );

  it("does not confirm while the subscription is not active yet", () => {
    mockUseBillingStatus.mockReturnValue({
      billing: { subscriptionStatus: "incomplete" },
    });

    renderAt("/settings?checkout=success");

    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByTestId("confirming").textContent).toBe("true");
  });

  it("gives up after the timeout and says the plan will appear shortly", () => {
    vi.useFakeTimers();
    renderAt("/settings?checkout=success");

    act(() => {
      vi.advanceTimersByTime(CHECKOUT_CONFIRM_TIMEOUT_MS);
    });

    expect(toast).toHaveBeenCalledWith(
      "Payment received. Your plan will update in a moment.",
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["currentUser"] });
    expect(screen.getByTestId("search").textContent).toBe("");
  });

  it("does not time out once confirmed", () => {
    vi.useFakeTimers();
    mockUseBillingStatus.mockReturnValue({
      billing: { subscriptionStatus: "active" },
    });
    renderAt("/settings?checkout=success");

    act(() => {
      vi.advanceTimersByTime(CHECKOUT_CONFIRM_TIMEOUT_MS * 2);
    });

    expect(toast).not.toHaveBeenCalled();
  });
});
