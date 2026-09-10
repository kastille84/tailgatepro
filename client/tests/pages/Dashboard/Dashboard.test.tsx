import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { MemoryRouter } from "react-router-dom";

import { Dashboard } from "../../../src/pages/Dashboard/Dashboard";
import theme from "../../../src/styles/theme";

const mockUseAuth = vi.fn();
vi.mock("../../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const renderDashboard = () =>
  render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <Dashboard />
      </ThemeProvider>
    </MemoryRouter>,
  );

describe("Dashboard page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading status while auth is resolving", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });

    renderDashboard();

    expect(screen.getByRole("status").textContent).toMatch(
      /loading your dashboard/i,
    );
  });

  it("shows an access-denied fallback when there is no user", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });

    renderDashboard();

    expect(screen.getByRole("status").textContent).toMatch(/access denied/i);
  });

  it("shows the signed-in user's email and the live Projects card link", () => {
    mockUseAuth.mockReturnValue({
      user: { email: "alex@example.com" },
      loading: false,
    });

    renderDashboard();

    expect(screen.getByText("alex@example.com")).toBeDefined();
    expect(
      screen.getByRole("heading", { name: /^welcome back$/i }),
    ).toBeDefined();

    const projectsCard = screen
      .getByRole("heading", { name: /^projects$/i })
      .closest("a");

    expect(projectsCard).not.toBeNull();
    expect(projectsCard?.getAttribute("href")).toBe("/projects");
  });

  it("renders the placeholder cards without links", () => {
    mockUseAuth.mockReturnValue({
      user: { email: "alex@example.com" },
      loading: false,
    });

    renderDashboard();

    expect(screen.getByText(/toolbox talks/i).closest("a")).toBeNull();
    expect(screen.getByText(/meeting logs/i).closest("a")).toBeNull();
    expect(screen.getByText(/gc compliance/i).closest("a")).toBeNull();
  });

  it("renders the shared footer branding", () => {
    mockUseAuth.mockReturnValue({
      user: { email: "alex@example.com" },
      loading: false,
    });

    renderDashboard();

    expect(
      screen.getByText(
        new RegExp(`© ${new Date().getFullYear()} TailgatePro`, "i"),
      ),
    ).toBeTruthy();
  });

  it("does not render a logout action in the current Dashboard implementation", () => {
    mockUseAuth.mockReturnValue({
      user: { email: "alex@example.com" },
      loading: false,
    });

    renderDashboard();

    expect(screen.queryByRole("button", { name: /logout/i })).toBeNull();
  });
});
