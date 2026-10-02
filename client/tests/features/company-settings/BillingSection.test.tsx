import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "styled-components";

import { BillingSection } from "../../../src/features/company-settings/BillingSection";
import type { BillingSummary } from "../../../src/interfaces/billing";
import theme from "../../../src/styles/theme";

const active: BillingSummary = {
  hasBillingAccount: true,
  subscriptionStatus: "active",
  billingInterval: "monthly",
  currentPeriodEnd: "2027-03-15T12:00:00.000Z",
};

const renderSection = (
  props: Partial<React.ComponentProps<typeof BillingSection>> = {},
) => {
  const onManage = vi.fn();
  render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <BillingSection
          planName="Trade Pro"
          billing={active}
          isLoading={false}
          isError={false}
          isConfirming={false}
          isOpening={false}
          onManage={onManage}
          {...props}
        />
      </ThemeProvider>
    </MemoryRouter>,
  );
  return { onManage };
};

describe("BillingSection", () => {
  it("shows the plan, status, interval and renewal date, and opens the portal", () => {
    const { onManage } = renderSection();

    expect(screen.getByText("Trade Pro")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
    expect(screen.getByText("Monthly")).toBeTruthy();
    expect(screen.getByText("Next renewal")).toBeTruthy();
    expect(screen.getByText("March 15, 2027")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /manage billing/i }));
    expect(onManage).toHaveBeenCalledTimes(1);
  });

  it("labels an annual subscription", () => {
    renderSection({ billing: { ...active, billingInterval: "annual" } });
    expect(screen.getByText("Annual")).toBeTruthy();
  });

  it("warns when the last payment failed", () => {
    renderSection({ billing: { ...active, subscriptionStatus: "past_due" } });

    expect(screen.getByText("Payment past due")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/last payment didn.t go through/i);
  });

  it("shows when a canceled subscription ended", () => {
    renderSection({ billing: { ...active, subscriptionStatus: "canceled" } });

    expect(screen.getByText("Canceled")).toBeTruthy();
    expect(screen.getByText("Ended")).toBeTruthy();
    expect(screen.queryByText("Next renewal")).toBeNull();
  });

  it("falls back to the raw status for one it has no label for", () => {
    renderSection({ billing: { ...active, subscriptionStatus: "paused" } });
    expect(screen.getByText("paused")).toBeTruthy();
  });

  it("points a company that never subscribed at the pricing page", () => {
    renderSection({
      planName: null,
      billing: {
        hasBillingAccount: false,
        subscriptionStatus: null,
        billingInterval: null,
        currentPeriodEnd: null,
      },
    });

    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.queryByText("Status")).toBeNull();
    expect(screen.queryByRole("button", { name: /manage billing/i })).toBeNull();
    expect(
      screen
        .getByRole("link", { name: /see plans and upgrade/i })
        .getAttribute("href"),
    ).toBe("/pricing");
  });

  it("omits the renewal row when Stripe has no period end", () => {
    renderSection({ billing: { ...active, currentPeriodEnd: null } });
    expect(screen.queryByText("Next renewal")).toBeNull();
  });

  it("shows a loading message while the details load", () => {
    renderSection({ billing: null, isLoading: true });
    expect(screen.getByText(/loading your billing details/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /manage billing/i })).toBeNull();
  });

  it("shows an error when the details could not be loaded", () => {
    renderSection({ billing: null, isError: true });
    expect(screen.getByRole("alert").textContent).toMatch(/could not load your billing details/i);
  });

  it("shows a confirming message while the payment is being confirmed", () => {
    renderSection({ isConfirming: true });
    expect(screen.getByText(/confirming your payment/i)).toBeTruthy();
  });
});
