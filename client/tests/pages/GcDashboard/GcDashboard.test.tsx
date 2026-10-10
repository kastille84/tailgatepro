import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { GcDashboard } from "../../../src/pages/GcDashboard/GcDashboard";
import theme from "../../../src/styles/theme";

const mockUseAuth = vi.fn();
const mockUseOnlineStatus = vi.fn();
const mockUseGcOverview = vi.fn();
const mockUseCurrentUser = vi.fn();
const mockUseInHouseCrews = vi.fn();

vi.mock("../../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));
vi.mock("../../../src/context/online-status", () => ({
  useOnlineStatus: () => mockUseOnlineStatus(),
}));
vi.mock("../../../src/hooks/useGcOverview", () => ({
  useGcOverview: (...args: unknown[]) => mockUseGcOverview(...args),
}));

vi.mock("../../../src/hooks/useCurrentUser", () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));
vi.mock("../../../src/hooks/useInHouseCrews", () => ({
  useInHouseCrews: (...args: unknown[]) => mockUseInHouseCrews(...args),
}));
vi.mock("../../../src/features/in-house-crews", () => ({
  InHouseOnboardingCard: ({
    companyId,
    onAddCrews,
  }: {
    companyId: string;
    onAddCrews: () => void;
  }) => (
    <button type="button" onClick={onAddCrews}>
      stub-onboarding-card {companyId}
    </button>
  ),
  CrewForm: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div role="dialog">
        stub-crew-form
        <button type="button" onClick={onClose}>
          stub-crew-form-close
        </button>
      </div>
    ) : null,
}));

// The feature components have their own tests; stub them so the page test
// stays focused on page state (guards, loading/error, offline note, opening
// the drill-in modal).
vi.mock("../../../src/features/gc-dashboard", () => ({
  StatTiles: ({ totals }: { totals: { subs: number } }) => (
    <div data-testid="stat-tiles">{totals.subs} subs</div>
  ),
  JobsiteList: ({
    jobsites,
    onSelectSub,
  }: {
    jobsites: { name: string }[];
    onSelectSub: (sub: { companyId: string }) => void;
  }) => (
    <div data-testid="jobsite-list">
      {jobsites.length} jobsites
      <button
        type="button"
        onClick={() => onSelectSub({ companyId: "sub-1" })}
      >
        stub-select-sub
      </button>
    </div>
  ),
  SubMeetingsModal: ({
    sub,
    onClose,
  }: {
    sub?: { companyId: string };
    onClose: () => void;
  }) =>
    sub ? (
      <div role="dialog">
        meetings for {sub.companyId}
        <button type="button" onClick={onClose}>
          stub-modal-close
        </button>
      </div>
    ) : null,
}));

const overview = {
  jobsites: [{ id: "jobsite-1", name: "Downtown Tower", subs: [] }],
  totals: { subs: 2, logged: 1, missing: 1 },
};

const renderPage = () =>
  render(
    <ThemeProvider theme={theme}>
      <GcDashboard />
    </ThemeProvider>,
  );

describe("GcDashboard page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { email: "gc@example.com" }, loading: false });
    mockUseOnlineStatus.mockReturnValue({ isOnline: true });
    mockUseGcOverview.mockReturnValue({
      overview,
      isLoading: false,
      isError: false,
    });
    mockUseCurrentUser.mockReturnValue({ companyId: "gc-1", isManagerRole: true });
    mockUseInHouseCrews.mockReturnValue({ crews: [], isLoaded: true });
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

  it("shows a spinner while the overview query is loading", () => {
    mockUseGcOverview.mockReturnValue({
      overview: null,
      isLoading: true,
      isError: false,
    });
    renderPage();
    expect(screen.getByRole("status", { name: /loading compliance/i })).toBeDefined();
  });

  it("shows an error message when the overview query fails", () => {
    mockUseGcOverview.mockReturnValue({
      overview: null,
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

  it("renders the stat tiles and jobsite list on success", () => {
    renderPage();
    expect(screen.getByTestId("stat-tiles")).toBeDefined();
    expect(screen.getByTestId("jobsite-list")).toBeDefined();
  });

  it("calls useGcOverview with today's date and tzOffset", () => {
    renderPage();
    const [date, tzOffset] = mockUseGcOverview.mock.calls[0];
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(typeof tzOffset).toBe("number");
  });

  it("opens the drill-in modal when a sub is selected, and closes it again", () => {
    renderPage();
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /stub-select-sub/i }));
    expect(screen.getByRole("dialog").textContent).toContain("sub-1");

    fireEvent.click(screen.getByRole("button", { name: /stub-modal-close/i }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  describe("in-house crews onboarding", () => {
    it("offers the onboarding card to a manager with no crews, and opens the crew form from it", () => {
      renderPage();

      expect(mockUseInHouseCrews).toHaveBeenCalledWith({ enabled: true });
      fireEvent.click(screen.getByRole("button", { name: /stub-onboarding-card gc-1/i }));
      expect(screen.getByText("stub-crew-form")).toBeDefined();

      fireEvent.click(screen.getByRole("button", { name: "stub-crew-form-close" }));
      expect(screen.queryByText("stub-crew-form")).toBeNull();
    });

    it("hides the card once the GC has a crew", () => {
      mockUseInHouseCrews.mockReturnValue({ crews: [{ id: "c1" }], isLoaded: true });
      renderPage();

      expect(screen.queryByText(/stub-onboarding-card/i)).toBeNull();
    });

    it("hides the card until the crews have loaded", () => {
      mockUseInHouseCrews.mockReturnValue({ crews: [], isLoaded: false });
      renderPage();

      expect(screen.queryByText(/stub-onboarding-card/i)).toBeNull();
    });

    it("hides the card from a role that cannot manage crews, without fetching them", () => {
      mockUseCurrentUser.mockReturnValue({ companyId: "gc-1", isManagerRole: false });
      renderPage();

      expect(mockUseInHouseCrews).toHaveBeenCalledWith({ enabled: false });
      expect(screen.queryByText(/stub-onboarding-card/i)).toBeNull();
    });

    it("hides the card when the company id is unknown", () => {
      mockUseCurrentUser.mockReturnValue({ companyId: null, isManagerRole: true });
      renderPage();

      expect(screen.queryByText(/stub-onboarding-card/i)).toBeNull();
    });
  });
});
