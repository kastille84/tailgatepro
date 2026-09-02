import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/context/auth", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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
});
