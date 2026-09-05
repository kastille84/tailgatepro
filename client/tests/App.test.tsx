import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/context/auth", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("../src/styles/GlobalStyles", () => ({
  default: () => null,
}));

vi.mock("../src/ui_comps/navbar/Navbar", () => ({
  Navbar: () => <nav data-testid="navbar">Nav</nav>,
}));

vi.mock("../src/pages/Landing", () => ({
  Landing: () => <div data-testid="landing-page">Landing page</div>,
}));

vi.mock("../src/pages/Pricing", () => ({
  Pricing: () => <div data-testid="pricing-page">Pricing page</div>,
}));

vi.mock("../src/pages/Login", () => ({
  Login: () => <div data-testid="login-page">Login page</div>,
}));

vi.mock("../src/pages/Signup", () => ({
  Signup: () => <div data-testid="signup-page">Signup page</div>,
}));

vi.mock("../src/pages/ForgotPassword", () => ({
  ForgotPassword: () => (
    <div data-testid="forgot-password-page">Forgot password page</div>
  ),
}));

vi.mock("../src/pages/ResetPassword", () => ({
  ResetPassword: () => (
    <div data-testid="reset-password-page">Reset password page</div>
  ),
}));

vi.mock("../src/pages/Dashboard", () => ({
  Dashboard: () => <div data-testid="dashboard-page">Dashboard page</div>,
}));

vi.mock("../src/features/authentication", async () => {
  const { Outlet } = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return { RequireAuth: () => <Outlet /> };
});

vi.mock("@tanstack/react-query-devtools", () => ({
  ReactQueryDevtools: () => <div data-testid="react-query-devtools" />,
}));

vi.mock("react-hot-toast", () => ({
  Toaster: () => <div data-testid="toaster" />,
}));

import App from "../src/App";

describe("App", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/landing");
  });

  it("renders the landing route shell with shared navigation and toasts", () => {
    render(<App />);

    expect(screen.getByTestId("navbar")).toBeDefined();
    expect(screen.getByTestId("landing-page")).toBeDefined();
    expect(screen.getByTestId("toaster")).toBeDefined();
  });

  it("renders the pricing route shell", () => {
    window.history.pushState({}, "", "/pricing");
    render(<App />);

    expect(screen.getByTestId("pricing-page")).toBeDefined();
  });

  it("renders the login route shell", () => {
    window.history.pushState({}, "", "/login");
    render(<App />);

    expect(screen.getByTestId("login-page")).toBeDefined();
  });

  it("renders the signup route shell", () => {
    window.history.pushState({}, "", "/signup");
    render(<App />);

    expect(screen.getByTestId("signup-page")).toBeDefined();
  });

  it("renders the forgot-password route shell", () => {
    window.history.pushState({}, "", "/forgot-password");
    render(<App />);

    expect(screen.getByTestId("forgot-password-page")).toBeDefined();
  });

  it("renders the reset-password route shell", () => {
    window.history.pushState({}, "", "/reset-password");
    render(<App />);

    expect(screen.getByTestId("reset-password-page")).toBeDefined();
  });

  it("renders the dashboard route shell behind the RequireAuth layout route", () => {
    window.history.pushState({}, "", "/dashboard");
    render(<App />);

    expect(screen.getByTestId("dashboard-page")).toBeDefined();
  });
});
