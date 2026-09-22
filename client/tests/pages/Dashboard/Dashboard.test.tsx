import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { MemoryRouter } from "react-router-dom";

import { Dashboard } from "../../../src/pages/Dashboard/Dashboard";
import theme from "../../../src/styles/theme";

const mockUseAuth = vi.fn();
const mockUseCurrentUser = vi.fn();
vi.mock("../../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));
vi.mock("../../../src/hooks/useCurrentUser", () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));
vi.mock("../../../src/pages/GcDashboard", () => ({
  GcDashboard: () => <div data-testid="gc-dashboard-page">GC Dashboard</div>,
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
    mockUseCurrentUser.mockReturnValue({ isGc: false, isLoading: false });
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

  it("shows the live Toolbox Talks card link", () => {
    mockUseAuth.mockReturnValue({
      user: { email: "alex@example.com" },
      loading: false,
    });

    renderDashboard();

    const talksCard = screen
      .getByRole("heading", { name: /^toolbox talks$/i })
      .closest("a");

    expect(talksCard).not.toBeNull();
    expect(talksCard?.getAttribute("href")).toBe("/talks");
  });

  it("shows the live Meeting Logs card link", () => {
    mockUseAuth.mockReturnValue({
      user: { email: "alex@example.com" },
      loading: false,
    });

    renderDashboard();

    const meetingLogsCard = screen
      .getByRole("heading", { name: /^meeting logs$/i })
      .closest("a");

    expect(meetingLogsCard).not.toBeNull();
    expect(meetingLogsCard?.getAttribute("href")).toBe("/meetings/new");
  });

  it("renders the remaining placeholder card without a link", () => {
    mockUseAuth.mockReturnValue({
      user: { email: "alex@example.com" },
      loading: false,
    });

    renderDashboard();

    expect(screen.getByText(/gc compliance/i).closest("a")).toBeNull();
  });

  it("shows a loading status while the current-user profile is resolving", () => {
    mockUseAuth.mockReturnValue({
      user: { email: "gc@example.com" },
      loading: false,
    });
    mockUseCurrentUser.mockReturnValue({ isGc: false, isLoading: true });

    renderDashboard();

    expect(screen.getByRole("status").textContent).toMatch(
      /loading your dashboard/i,
    );
  });

  it("renders the GC compliance dashboard in place of the hub for a GC company", () => {
    mockUseAuth.mockReturnValue({
      user: { email: "gc@example.com" },
      loading: false,
    });
    mockUseCurrentUser.mockReturnValue({ isGc: true, isLoading: false });

    renderDashboard();

    expect(screen.getByTestId("gc-dashboard-page")).toBeDefined();
    expect(screen.queryByRole("heading", { name: /^welcome back$/i })).toBeNull();
    expect(screen.queryByRole("heading", { name: /^projects$/i })).toBeNull();
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
