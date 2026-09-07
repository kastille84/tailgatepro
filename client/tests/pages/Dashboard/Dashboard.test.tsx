import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { Dashboard } from "../../../src/pages/Dashboard/Dashboard";
import theme from "../../../src/styles/theme";

const mockUseAuth = vi.fn();
vi.mock("../../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const renderDashboard = () =>
  render(
    <ThemeProvider theme={theme}>
      <Dashboard />
    </ThemeProvider>,
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

  it("shows the signed-in user's email and placeholder copy", () => {
    mockUseAuth.mockReturnValue({
      user: { email: "alex@example.com" },
      loading: false,
      logout: vi.fn(),
    });

    renderDashboard();

    expect(screen.getByText("alex@example.com")).toBeDefined();
    expect(
      screen.getByText(/toolbox talks, meeting logs/i),
    ).toBeDefined();
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
