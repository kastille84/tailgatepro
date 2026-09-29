import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { GcSubcontractorDetail } from "../../../src/pages/GcSubcontractorDetail/GcSubcontractorDetail";
import theme from "../../../src/styles/theme";

const mockUseAuth = vi.fn();
const mockUseOnlineStatus = vi.fn();
const mockUseCurrentUser = vi.fn();
const mockUseGcSubcontractorScorecard = vi.fn();

vi.mock("../../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));
vi.mock("../../../src/context/online-status", () => ({
  useOnlineStatus: () => mockUseOnlineStatus(),
}));
vi.mock("../../../src/hooks/useCurrentUser", () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));
vi.mock("../../../src/hooks/useGcSubcontractorScorecard", () => ({
  useGcSubcontractorScorecard: (...args: unknown[]) =>
    mockUseGcSubcontractorScorecard(...args),
}));

// The feature components have their own tests; stub them so this page test
// stays focused on page state.
vi.mock("../../../src/features/gc-subcontractors", () => ({
  ScoreBadge: ({ score }: { score: number }) => <span>{score}%</span>,
  JobsiteBreakdownTable: ({ jobsites }: { jobsites: { jobsiteId: string }[] }) => (
    <div data-testid="breakdown-table">{jobsites.length} jobsites</div>
  ),
  SubScorecardUpgradeNotice: () => <div data-testid="upgrade-notice">Upgrade notice</div>,
}));

const detail = {
  companyId: "sub-1",
  companyName: "Rivera Electric",
  overallScore: 87,
  jobsites: [
    { jobsiteId: "jobsite-1", jobsiteName: "Downtown Tower", cadence: "daily", expectedPeriods: 30, loggedPeriods: 26, score: 87 },
  ],
};

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider theme={theme}>
        <Routes>
          <Route path="/gc/subcontractors/:companyId" element={<GcSubcontractorDetail />} />
          <Route path="/gc/subcontractors/detail" element={<GcSubcontractorDetail />} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>,
  );

describe("GcSubcontractorDetail page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { email: "gc@example.com" }, loading: false });
    mockUseOnlineStatus.mockReturnValue({ isOnline: true });
    mockUseCurrentUser.mockReturnValue({ plan: "gc-portfolio" });
    mockUseGcSubcontractorScorecard.mockReturnValue({
      scorecard: detail,
      isLoading: false,
      isError: false,
      error: null,
    });
  });

  it("shows a loading status while auth resolves", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    renderAt("/gc/subcontractors/sub-1");
    expect(screen.getByText(/loading/i)).toBeDefined();
  });

  it("shows an access-denied fallback when there is no user", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    renderAt("/gc/subcontractors/sub-1");
    expect(screen.getByText(/access denied/i)).toBeDefined();
  });

  it("renders a back link to the subcontractors list", () => {
    renderAt("/gc/subcontractors/sub-1");
    expect(
      screen.getByRole("link", { name: /all subcontractors/i }).getAttribute("href"),
    ).toBe("/gc/subcontractors");
  });

  it("passes the companyId route param, today's date and tzOffset to the hook", () => {
    renderAt("/gc/subcontractors/sub-1");
    const [companyId, date, tzOffset] = mockUseGcSubcontractorScorecard.mock.calls[0];
    expect(companyId).toBe("sub-1");
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(typeof tzOffset).toBe("number");
  });

  it("shows a spinner while the scorecard query is loading", () => {
    mockUseGcSubcontractorScorecard.mockReturnValue({
      scorecard: null,
      isLoading: true,
      isError: false,
      error: null,
    });
    renderAt("/gc/subcontractors/sub-1");
    expect(screen.getByRole("status", { name: /loading scorecard/i })).toBeDefined();
  });

  it("shows a not-found message when the sub isn't on the caller's portfolio", () => {
    mockUseGcSubcontractorScorecard.mockReturnValue({
      scorecard: null,
      isLoading: false,
      isError: true,
      error: new Error("Subcontractor not found"),
    });
    renderAt("/gc/subcontractors/sub-9");
    expect(screen.getByRole("alert").textContent).toMatch(/isn't on your portfolio/i);
  });

  it("shows a generic error message for any other failure", () => {
    mockUseGcSubcontractorScorecard.mockReturnValue({
      scorecard: null,
      isLoading: false,
      isError: true,
      error: new Error("boom"),
    });
    renderAt("/gc/subcontractors/sub-1");
    expect(screen.getByRole("alert").textContent).toMatch(/could not load/i);
  });

  it("shows an offline note when offline", () => {
    mockUseOnlineStatus.mockReturnValue({ isOnline: false });
    renderAt("/gc/subcontractors/sub-1");
    expect(screen.getByText(/you're offline/i)).toBeDefined();
  });

  it("renders the company name, overall score and breakdown table on success", () => {
    renderAt("/gc/subcontractors/sub-1");
    expect(screen.getByText("Rivera Electric")).toBeDefined();
    expect(screen.getByText("87%")).toBeDefined();
    expect(screen.getByTestId("breakdown-table").textContent).toBe("1 jobsites");
  });

  it("falls back to a placeholder name when companyName is null", () => {
    mockUseGcSubcontractorScorecard.mockReturnValue({
      scorecard: { ...detail, companyName: null },
      isLoading: false,
      isError: false,
      error: null,
    });
    renderAt("/gc/subcontractors/sub-1");
    expect(screen.getByText("Unknown company")).toBeDefined();
  });

  it("passes an empty companyId to the hook when the route has none", () => {
    renderAt("/gc/subcontractors/detail");
    expect(mockUseGcSubcontractorScorecard.mock.calls[0][0]).toBe("");
  });

  it("shows an upgrade notice instead of data for a non-Portfolio GC", () => {
    mockUseCurrentUser.mockReturnValue({ plan: "gc-free" });
    mockUseGcSubcontractorScorecard.mockReturnValue({
      scorecard: null,
      isLoading: false,
      isError: false,
      error: null,
    });

    renderAt("/gc/subcontractors/sub-1");

    expect(screen.getByTestId("upgrade-notice")).toBeDefined();
    expect(screen.queryByTestId("breakdown-table")).toBeNull();
    // The hook is called with an empty companyId so it never fires the real
    // fetch while gated out.
    expect(mockUseGcSubcontractorScorecard.mock.calls[0][0]).toBe("");
  });
});
