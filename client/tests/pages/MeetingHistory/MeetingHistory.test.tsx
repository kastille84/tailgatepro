import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { MemoryRouter } from "react-router-dom";

import { MeetingHistory } from "../../../src/pages/MeetingHistory/MeetingHistory";
import theme from "../../../src/styles/theme";

const mockUseAuth = vi.fn();
const mockUseCurrentUser = vi.fn();
const mockUseMeetingMonths = vi.fn();

vi.mock("../../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));
vi.mock("../../../src/hooks/useCurrentUser", () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));
vi.mock("../../../src/hooks/useMeetingMonths", () => ({
  useMeetingMonths: () => mockUseMeetingMonths(),
}));

// The feature components have their own tests; stub them so this test stays
// focused on page state (guards, banner, month selection via the URL).
// `isValidMonth` stays real: the page's `?month=` handling depends on it.
vi.mock("../../../src/features/meeting-history", async () => {
  const actual = await vi.importActual<
    typeof import("../../../src/features/meeting-history")
  >("../../../src/features/meeting-history");
  return {
    ...actual,
    MonthCards: ({
      months,
      onSelect,
    }: {
      months: { month: string }[];
      onSelect: (month: string) => void;
    }) => (
      <div data-testid="month-cards">
        {months.length} months
        {months.map((m) => (
          <button key={m.month} type="button" onClick={() => onSelect(m.month)}>
            pick-{m.month}
          </button>
        ))}
      </div>
    ),
    MonthMeetings: ({
      month,
      onBack,
    }: {
      month: string;
      onBack: () => void;
    }) => (
      <div data-testid="month-meetings">
        showing-{month}
        <button type="button" onClick={onBack}>
          stub-back
        </button>
      </div>
    ),
  };
});

const months = (overrides = {}) => ({
  months: [{ month: "2026-09", count: 3 }],
  hiddenCount: 0,
  historyDays: null,
  isLoading: false,
  isError: false,
  ...overrides,
});

const renderPage = (initialEntry = "/meetings") =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ThemeProvider theme={theme}>
        <MeetingHistory />
      </ThemeProvider>
    </MemoryRouter>,
  );

describe("MeetingHistory page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { email: "a@b.com" }, loading: false });
    mockUseCurrentUser.mockReturnValue({ limits: { archiveYears: 5 } });
    mockUseMeetingMonths.mockReturnValue(months());
  });

  it("shows a loading status while auth is loading", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    renderPage();
    expect(screen.getByText("Loading…")).toBeDefined();
  });

  it("denies access when there is no user", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    renderPage();
    expect(screen.getByText(/access denied/i)).toBeDefined();
  });

  it("shows the month cards by default", () => {
    renderPage();
    expect(screen.getByTestId("month-cards")).toBeDefined();
    expect(screen.queryByTestId("month-meetings")).toBeNull();
  });

  it("opens a month when its card is picked, and returns to the cards", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "pick-2026-09" }));
    expect(screen.getByTestId("month-meetings").textContent).toContain(
      "showing-2026-09",
    );
    expect(screen.queryByTestId("month-cards")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "stub-back" }));
    expect(screen.getByTestId("month-cards")).toBeDefined();
  });

  it("opens the month named in the ?month= param", () => {
    renderPage("/meetings?month=2026-08");
    expect(screen.getByTestId("month-meetings").textContent).toContain(
      "showing-2026-08",
    );
  });

  it("ignores an invalid ?month= param", () => {
    renderPage("/meetings?month=garbage");
    expect(screen.getByTestId("month-cards")).toBeDefined();
  });

  it("shows the retention note on a plan with an archive", () => {
    renderPage();
    expect(
      screen.getByText("Your meeting records are kept for 5 years."),
    ).toBeDefined();
    expect(screen.queryByText(/free plan/i)).toBeNull();
  });

  it("shows the upgrade banner with the hidden count on Free (plural)", () => {
    mockUseCurrentUser.mockReturnValue({ limits: { archiveYears: 0 } });
    mockUseMeetingMonths.mockReturnValue(
      months({ hiddenCount: 4, historyDays: 30 }),
    );
    renderPage();
    expect(
      screen.getByText("4 older meetings are hidden on the free plan"),
    ).toBeDefined();
    expect(
      screen
        .getByRole("link", { name: /upgrade to trade pro/i })
        .getAttribute("href"),
    ).toBe("/pricing");
    expect(screen.queryByText(/kept for/i)).toBeNull();
  });

  it("uses the singular wording for one hidden meeting", () => {
    mockUseCurrentUser.mockReturnValue({ limits: undefined });
    mockUseMeetingMonths.mockReturnValue(
      months({ hiddenCount: 1, historyDays: 30 }),
    );
    renderPage();
    expect(
      screen.getByText("1 older meeting is hidden on the free plan"),
    ).toBeDefined();
  });

  it("shows the 30-day window notice on Free even when nothing is hidden yet", () => {
    mockUseCurrentUser.mockReturnValue({ limits: { archiveYears: 0 } });
    mockUseMeetingMonths.mockReturnValue(
      months({ hiddenCount: 0, historyDays: 30 }),
    );
    renderPage();
    expect(
      screen.getByText("Free plan: meetings are viewable for 30 days"),
    ).toBeDefined();
  });

  it("keeps the banner visible while a month is open", () => {
    mockUseMeetingMonths.mockReturnValue(months({ historyDays: 30 }));
    renderPage("/meetings?month=2026-09");
    expect(
      screen.getByText("Free plan: meetings are viewable for 30 days"),
    ).toBeDefined();
  });

  it("shows a spinner while the months load", () => {
    mockUseMeetingMonths.mockReturnValue(
      months({ months: [], isLoading: true }),
    );
    renderPage();
    expect(screen.getByText("Loading your meetings…")).toBeDefined();
    expect(screen.queryByTestId("month-cards")).toBeNull();
  });

  it("shows an error when the months fail to load", () => {
    mockUseMeetingMonths.mockReturnValue(months({ months: [], isError: true }));
    renderPage();
    expect(screen.getByRole("alert").textContent).toMatch(
      /could not load your meetings/i,
    );
    expect(screen.queryByTestId("month-cards")).toBeNull();
  });
});
