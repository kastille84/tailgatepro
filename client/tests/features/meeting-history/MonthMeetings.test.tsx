import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { MonthMeetings } from "../../../src/features/meeting-history/MonthMeetings";
import { monthRange } from "../../../src/features/meeting-history/monthUtils";
import theme from "../../../src/styles/theme";

const mockUseMeetingLogs = vi.fn();
const mockUseProjects = vi.fn();
const mockUseTalks = vi.fn();
const mockUseMeetingPdfUrl = vi.fn();
const openPdf = vi.fn();
const onBack = vi.fn();

vi.mock("../../../src/hooks/useMeetingLogs", () => ({
  useMeetingLogs: (...args: unknown[]) => mockUseMeetingLogs(...args),
}));
vi.mock("../../../src/hooks/useProjects", () => ({
  useProjects: () => mockUseProjects(),
}));
vi.mock("../../../src/hooks/useTalks", () => ({
  useTalks: () => mockUseTalks(),
}));
vi.mock("../../../src/hooks/useMeetingPdfUrl", () => ({
  useMeetingPdfUrl: () => mockUseMeetingPdfUrl(),
}));

const baseMeeting = {
  id: "meeting-1",
  projectId: "project-1",
  talkId: "talk-1",
  foremanId: "user-1",
  companyId: "company-1",
  crewPhotoUrl: null,
  finalPdfUrl: "meeting-1/report.pdf",
  completedAt: "2026-09-21T13:05:00.000Z",
  heldAt: "2026-09-21T13:00:00.000Z",
  syncedAt: null,
  createdAt: "2026-09-21T13:00:00.000Z",
};

const logs = (overrides = {}) => ({
  meetings: [baseMeeting],
  isLoading: false,
  isError: false,
  ...overrides,
});

const renderMonth = () =>
  render(
    <ThemeProvider theme={theme}>
      <MonthMeetings month="2026-09" onBack={onBack} />
    </ThemeProvider>,
  );

describe("MonthMeetings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMeetingLogs.mockReturnValue(logs());
    mockUseProjects.mockReturnValue({
      projects: [{ id: "project-1", name: "Downtown Tower" }],
    });
    mockUseTalks.mockReturnValue({
      talks: [{ id: "talk-1", title: "Fall Protection" }],
    });
    mockUseMeetingPdfUrl.mockReturnValue({ openPdf, isPending: false });
  });

  it("fetches only the chosen month's range and titles the list", () => {
    renderMonth();
    expect(mockUseMeetingLogs).toHaveBeenCalledWith(monthRange("2026-09"));
    expect(
      screen.getByRole("heading", { name: /2026/ }),
    ).toBeDefined();
  });

  it("goes back to all months", () => {
    renderMonth();
    fireEvent.click(screen.getByRole("button", { name: /all months/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it("lists a meeting with its talk title, project and date", () => {
    renderMonth();
    expect(screen.getByText("Fall Protection")).toBeDefined();
    expect(screen.getByText(/Downtown Tower · .*2026/)).toBeDefined();
  });

  it("falls back to placeholder names and the created date when lookups are missing", () => {
    mockUseProjects.mockReturnValue({ projects: [] });
    mockUseTalks.mockReturnValue({ talks: [] });
    mockUseMeetingLogs.mockReturnValue(
      logs({ meetings: [{ ...baseMeeting, heldAt: null }] }),
    );
    renderMonth();
    expect(screen.getByText("Untitled talk")).toBeDefined();
    expect(screen.getByText(/Unknown project · .*2026/)).toBeDefined();
  });

  it("opens the PDF for a meeting that has one", () => {
    renderMonth();
    fireEvent.click(screen.getByRole("button", { name: /open pdf/i }));
    expect(openPdf).toHaveBeenCalledWith("meeting-1");
  });

  it("disables the PDF button while a PDF link is being fetched", () => {
    mockUseMeetingPdfUrl.mockReturnValue({ openPdf, isPending: true });
    renderMonth();
    expect(
      (screen.getByRole("button", { name: /open pdf/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("shows PDF pending when no PDF has been generated yet", () => {
    mockUseMeetingLogs.mockReturnValue(
      logs({ meetings: [{ ...baseMeeting, finalPdfUrl: null }] }),
    );
    renderMonth();
    expect(screen.getByText("PDF pending")).toBeDefined();
    expect(screen.queryByRole("button", { name: /open pdf/i })).toBeNull();
  });

  it("shows an empty state for a month with no meetings", () => {
    mockUseMeetingLogs.mockReturnValue(logs({ meetings: [] }));
    renderMonth();
    expect(screen.getByText("No completed meetings this month.")).toBeDefined();
  });

  it("shows a spinner while the month loads", () => {
    mockUseMeetingLogs.mockReturnValue(logs({ meetings: [], isLoading: true }));
    renderMonth();
    expect(screen.getByText("Loading this month…")).toBeDefined();
    expect(screen.queryByText(/no completed meetings/i)).toBeNull();
  });

  it("shows an error when the month fails to load", () => {
    mockUseMeetingLogs.mockReturnValue(logs({ meetings: [], isError: true }));
    renderMonth();
    expect(screen.getByRole("alert").textContent).toMatch(
      /could not load this month/i,
    );
    expect(screen.queryByText(/no completed meetings/i)).toBeNull();
  });
});
