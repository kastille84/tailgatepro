import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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
    mockUseAuth.mockReturnValue({ user: null, loading: true, logout: vi.fn() });

    renderDashboard();

    expect(screen.getByText(/loading your dashboard/i)).toBeDefined();
  });

  it("shows an access-denied fallback when there is no user", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, logout: vi.fn() });

    renderDashboard();

    expect(screen.getByText(/access denied/i)).toBeDefined();
  });

  it("shows the signed-in user's email and an active Projects card linking to /projects", () => {
    mockUseAuth.mockReturnValue({
      user: { email: "alex@example.com" },
      loading: false,
      logout: vi.fn(),
    });

    renderDashboard();

    expect(screen.getByText("alex@example.com")).toBeDefined();

    const projectsCard = screen
      .getByRole("heading", { name: /^projects$/i })
      .closest("a");
    expect(projectsCard?.getAttribute("href")).toBe("/projects");

    // The not-yet-built areas are shown but are not links.
    expect(screen.getByText(/toolbox talks/i).closest("a")).toBeNull();
    expect(screen.getByText(/meeting logs/i).closest("a")).toBeNull();
    expect(screen.getByText(/gc compliance/i).closest("a")).toBeNull();

    // Shared footer is rendered (branding line, mirrors the Landing test).
    expect(
      screen.getByText(
        new RegExp(`© ${new Date().getFullYear()} TailgatePro`, "i"),
      ),
    ).toBeTruthy();
  });

  it("calls logout when the Logout button is clicked", async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      user: { email: "alex@example.com" },
      loading: false,
      logout,
    });

    renderDashboard();

    fireEvent.click(screen.getByRole("button", { name: /logout/i }));

    await waitFor(() => {
      expect(logout).toHaveBeenCalledTimes(1);
    });
  });
});
