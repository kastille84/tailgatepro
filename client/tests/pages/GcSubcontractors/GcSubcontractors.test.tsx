import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { MemoryRouter } from "react-router-dom";

import { GcSubcontractors } from "../../../src/pages/GcSubcontractors/GcSubcontractors";
import theme from "../../../src/styles/theme";

const mockUseAuth = vi.fn();
const mockUseOnlineStatus = vi.fn();
const mockUseCurrentUser = vi.fn();
const mockUseGcSubcontractorScorecards = vi.fn();

vi.mock("../../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));
vi.mock("../../../src/context/online-status", () => ({
  useOnlineStatus: () => mockUseOnlineStatus(),
}));
vi.mock("../../../src/hooks/useCurrentUser", () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));
vi.mock("../../../src/hooks/useGcSubcontractorScorecards", () => ({
  useGcSubcontractorScorecards: (...args: unknown[]) =>
    mockUseGcSubcontractorScorecards(...args),
}));

// The feature components have their own tests; stub them so this page test
// stays focused on page state (guards, plan gate, loading/error, offline note).
vi.mock("../../../src/features/gc-subcontractors", () => ({
  SubScorecardList: ({ scorecards }: { scorecards: { companyId: string }[] }) => (
    <div data-testid="scorecard-list">{scorecards.length} subs</div>
  ),
  SubScorecardUpgradeNotice: () => <div data-testid="upgrade-notice">Upgrade notice</div>,
}));

const scorecards = [{ companyId: "sub-1", companyName: "Rivera Electric", overallScore: 87 }];

const renderPage = () =>
  render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <GcSubcontractors />
      </ThemeProvider>
    </MemoryRouter>,
  );

describe("GcSubcontractors page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { email: "gc@example.com" }, loading: false });
    mockUseOnlineStatus.mockReturnValue({ isOnline: true });
    mockUseCurrentUser.mockReturnValue({ plan: "gc-portfolio" });
    mockUseGcSubcontractorScorecards.mockReturnValue({
      scorecards,
      isLoading: false,
      isError: false,
    });
  });

  it("shows a loading status while auth resolves", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    renderPage();
    expect(screen.getByText(/loading/i)).toBeDefined();
  });

  it("shows an access-denied fallback when there is no user", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    renderPage();
    expect(screen.getByText(/access denied/i)).toBeDefined();
  });

  it("shows a spinner while the scorecards query is loading", () => {
    mockUseGcSubcontractorScorecards.mockReturnValue({
      scorecards: null,
      isLoading: true,
      isError: false,
    });
    renderPage();
    expect(screen.getByRole("status", { name: /loading scorecards/i })).toBeDefined();
  });

  it("shows an error message when the scorecards query fails", () => {
    mockUseGcSubcontractorScorecards.mockReturnValue({
      scorecards: null,
      isLoading: false,
      isError: true,
    });
    renderPage();
    expect(screen.getByRole("alert")).toBeDefined();
  });

  it("shows an offline note when offline", () => {
    mockUseOnlineStatus.mockReturnValue({ isOnline: false });
    renderPage();
    expect(screen.getByText(/you're offline/i)).toBeDefined();
  });

  it("renders the scorecard list on success", () => {
    renderPage();
    expect(screen.getByTestId("scorecard-list").textContent).toBe("1 subs");
  });

  it("calls useGcSubcontractorScorecards with today's date and tzOffset", () => {
    renderPage();
    const [date, tzOffset] = mockUseGcSubcontractorScorecards.mock.calls[0];
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(typeof tzOffset).toBe("number");
  });

  it("shows an upgrade notice instead of data for a non-Portfolio GC, without a spinner or error", () => {
    mockUseCurrentUser.mockReturnValue({ plan: "gc-free" });
    mockUseGcSubcontractorScorecards.mockReturnValue({
      scorecards: null,
      isLoading: false,
      isError: false,
    });

    renderPage();

    expect(screen.getByTestId("upgrade-notice")).toBeDefined();
    expect(screen.queryByTestId("scorecard-list")).toBeNull();
    expect(screen.queryByRole("status", { name: /loading scorecards/i })).toBeNull();
  });
});
