import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import toast from "react-hot-toast";

import {
  SITE_CHECKOUT_CONFIRM_TIMEOUT_MS,
  useSiteCheckoutReturn,
} from "../../src/hooks/useSiteCheckoutReturn";

vi.mock("react-hot-toast", () => {
  const toastFn = Object.assign(vi.fn(), { success: vi.fn() });
  return { default: toastFn };
});

const mockUseJobsites = vi.fn();
vi.mock("../../src/hooks/useJobsites", () => ({
  useJobsites: (options: unknown) => mockUseJobsites(options),
}));

const Probe = () => {
  const { isConfirming } = useSiteCheckoutReturn();
  const location = useLocation();
  return (
    <div>
      <span data-testid="confirming">{String(isConfirming)}</span>
      <span data-testid="search">{location.search}</span>
    </div>
  );
};

const renderAt = (route: string) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <Probe />
    </MemoryRouter>,
  );

describe("useSiteCheckoutReturn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseJobsites.mockReturnValue({ jobsites: [{ id: "site-1", plan: "free" }] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does nothing on a normal visit", () => {
    renderAt("/projects");

    expect(screen.getByTestId("confirming").textContent).toBe("false");
    expect(mockUseJobsites).toHaveBeenCalledWith({ poll: false });
    expect(toast).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("says nothing was charged on cancel and clears the param", () => {
    renderAt("/projects?siteCheckout=cancel&keep=1");

    expect(toast).toHaveBeenCalledWith("Checkout canceled. You haven't been charged.");
    expect(screen.getByTestId("search").textContent).toBe("?keep=1");
  });

  it("polls the jobsites while confirming a successful checkout", () => {
    renderAt("/projects?siteCheckout=success&jobsiteId=site-1");

    expect(screen.getByTestId("confirming").textContent).toBe("true");
    expect(mockUseJobsites).toHaveBeenCalledWith({ poll: true });
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("confirms and clears the params once that jobsite reads site_pro", () => {
    mockUseJobsites.mockReturnValue({
      jobsites: [
        { id: "other", plan: "site_pro" },
        { id: "site-1", plan: "site_pro" },
      ],
    });

    renderAt("/projects?siteCheckout=success&jobsiteId=site-1&keep=1");

    expect(toast.success).toHaveBeenCalledWith("Site Pro is active. Thanks for upgrading!");
    expect(screen.getByTestId("search").textContent).toBe("?keep=1");
  });

  it("does not confirm when a different jobsite is the Site Pro one", () => {
    mockUseJobsites.mockReturnValue({
      jobsites: [
        { id: "other", plan: "site_pro" },
        { id: "site-1", plan: "free" },
      ],
    });

    renderAt("/projects?siteCheckout=success&jobsiteId=site-1");

    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByTestId("confirming").textContent).toBe("true");
  });

  it("gives up after the timeout and says Site Pro will appear shortly", () => {
    vi.useFakeTimers();
    renderAt("/projects?siteCheckout=success&jobsiteId=site-1");

    act(() => {
      vi.advanceTimersByTime(SITE_CHECKOUT_CONFIRM_TIMEOUT_MS);
    });

    expect(toast).toHaveBeenCalledWith("Payment received. Site Pro will appear in a moment.");
    expect(screen.getByTestId("search").textContent).toBe("");
  });

  it("does not time out once confirmed", () => {
    vi.useFakeTimers();
    mockUseJobsites.mockReturnValue({ jobsites: [{ id: "site-1", plan: "site_pro" }] });
    renderAt("/projects?siteCheckout=success&jobsiteId=site-1");

    act(() => {
      vi.advanceTimersByTime(SITE_CHECKOUT_CONFIRM_TIMEOUT_MS * 2);
    });

    expect(toast).not.toHaveBeenCalled();
  });
});
