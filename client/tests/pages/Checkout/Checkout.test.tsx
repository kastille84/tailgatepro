import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import toast from "react-hot-toast";

import { Checkout } from "../../../src/pages/Checkout/Checkout";
import theme from "../../../src/styles/theme";
import { AlreadySubscribedError } from "../../../src/utils/AlreadySubscribedError";
import {
  readPendingCheckout,
  savePendingCheckout,
} from "../../../src/utils/pendingCheckout";

vi.mock("react-hot-toast", () => ({
  default: vi.fn(),
}));

const mockUseCurrentUser = vi.fn();
vi.mock("../../../src/hooks/useCurrentUser", () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));

const mockStartCheckout = vi.fn();
const mockUseCheckout = vi.fn();
vi.mock("../../../src/hooks/useCheckout", () => ({
  useCheckout: () => mockUseCheckout(),
}));

const renderCheckout = (route = "/checkout?plan=trade-pro&interval=monthly") =>
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/settings" element={<div data-testid="settings-page" />} />
          <Route path="/pricing" element={<div data-testid="pricing-page" />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );

const subManager = {
  companyType: "subcontractor",
  isManagerRole: true,
  isLoading: false,
};

describe("Checkout page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockUseCurrentUser.mockReturnValue(subManager);
    mockUseCheckout.mockReturnValue({
      startCheckout: mockStartCheckout,
      isStarting: false,
      error: null,
    });
  });

  it("starts checkout once for a manager whose company type matches the plan", () => {
    const { rerender } = renderCheckout();

    expect(
      screen.getByRole("heading", { name: /taking you to secure checkout/i }),
    ).toBeTruthy();
    expect(screen.getByText(/setting up trade pro/i)).toBeTruthy();
    expect(mockStartCheckout).toHaveBeenCalledTimes(1);
    expect(mockStartCheckout).toHaveBeenCalledWith({
      plan: "trade-pro",
      interval: "monthly",
    });

    rerender(
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={["/checkout?plan=trade-pro&interval=monthly"]}>
          <Routes>
            <Route path="/checkout" element={<Checkout />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    );
    expect(mockStartCheckout).toHaveBeenCalledTimes(1);
  });

  it("clears the remembered plan choice so it is not replayed on a later login", () => {
    savePendingCheckout({ plan: "trade-pro", interval: "monthly" });
    expect(readPendingCheckout()).not.toBeNull();

    renderCheckout();

    expect(readPendingCheckout()).toBeNull();
  });

  it("explains an invalid plan link and does not start checkout", () => {
    renderCheckout("/checkout?plan=nope&interval=monthly");

    expect(screen.getByRole("heading", { name: /isn.t valid/i })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /see pricing/i }).getAttribute("href"),
    ).toBe("/pricing");
    expect(mockStartCheckout).not.toHaveBeenCalled();
  });

  it("waits while the profile is loading", () => {
    mockUseCurrentUser.mockReturnValue({ ...subManager, isLoading: true });

    renderCheckout();

    expect(screen.getByText(/loading your account/i)).toBeTruthy();
    expect(mockStartCheckout).not.toHaveBeenCalled();
  });

  it("asks a non-manager to involve their admin", () => {
    mockUseCurrentUser.mockReturnValue({ ...subManager, isManagerRole: false });

    renderCheckout();

    expect(
      screen.getByRole("heading", { name: /ask your admin to upgrade/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /back to dashboard/i }).getAttribute("href"),
    ).toBe("/dashboard");
    expect(mockStartCheckout).not.toHaveBeenCalled();
  });

  it("explains a subcontractor plan on a general contractor account", () => {
    mockUseCurrentUser.mockReturnValue({ ...subManager, companyType: "gc" });

    renderCheckout();

    expect(screen.getByText(/not available for general contractor accounts/i)).toBeTruthy();
    expect(mockStartCheckout).not.toHaveBeenCalled();
  });

  it("explains a GC plan on a subcontractor account", () => {
    renderCheckout("/checkout?plan=gc-portfolio-10&interval=annual");

    expect(screen.getByText(/not available for subcontractor accounts/i)).toBeTruthy();
    expect(mockStartCheckout).not.toHaveBeenCalled();
  });

  it("shows the error with a retry that starts checkout again", () => {
    mockUseCheckout.mockReturnValue({
      startCheckout: mockStartCheckout,
      isStarting: false,
      error: new Error("Could not start checkout"),
    });

    renderCheckout();

    expect(screen.getByRole("alert").textContent).toBe("Could not start checkout");
    expect(
      screen.getByRole("link", { name: /back to pricing/i }).getAttribute("href"),
    ).toBe("/pricing");

    mockStartCheckout.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(mockStartCheckout).toHaveBeenCalledWith({
      plan: "trade-pro",
      interval: "monthly",
    });
  });

  it("sends an already-subscribed company to Settings with a notice", () => {
    mockUseCheckout.mockReturnValue({
      startCheckout: mockStartCheckout,
      isStarting: false,
      error: new AlreadySubscribedError("Already subscribed"),
    });

    renderCheckout();

    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/already have a subscription/i));
    expect(screen.getByTestId("settings-page")).toBeTruthy();
  });
});
