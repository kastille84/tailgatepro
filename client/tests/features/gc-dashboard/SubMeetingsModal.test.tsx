import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { SubMeetingsModal } from "../../../src/features/gc-dashboard";
import theme from "../../../src/styles/theme";
import type {
  GcMeetingSummary,
  GcSubCompliance,
} from "../../../src/interfaces/gcDashboard";

const mockUseOnlineStatus = vi.fn();
vi.mock("../../../src/context/online-status", () => ({
  useOnlineStatus: () => mockUseOnlineStatus(),
}));

const mockUseGcMeetings = vi.fn();
vi.mock("../../../src/hooks/useGcMeetings", () => ({
  useGcMeetings: (...args: unknown[]) => mockUseGcMeetings(...args),
}));

const mockOpenPdf = vi.fn();
const mockUseGcMeetingPdfUrl = vi.fn();
vi.mock("../../../src/hooks/useGcMeetingPdfUrl", () => ({
  useGcMeetingPdfUrl: () => mockUseGcMeetingPdfUrl(),
}));

const sub: GcSubCompliance = {
  companyId: "sub-1",
  companyName: "Rivera Electric",
  projectId: "project-1",
  status: "logged",
  lastLoggedAt: "2026-09-21T13:00:00.000Z",
  count: 1,
};

const meeting: GcMeetingSummary = {
  id: "meeting-1",
  projectId: "project-1",
  projectName: "Downtown Tower",
  companyId: "sub-1",
  companyName: "Rivera Electric",
  talkTitle: "Fall Protection",
  heldAt: "2026-09-21T13:00:00.000Z",
  completedAt: "2026-09-21T13:05:00.000Z",
  signerCount: 2,
  pdfReady: true,
};

const renderModal = (
  props: Partial<React.ComponentProps<typeof SubMeetingsModal>> = {},
) =>
  render(
    <ThemeProvider theme={theme}>
      <SubMeetingsModal sub={sub} onClose={vi.fn()} {...props} />
    </ThemeProvider>,
  );

describe("SubMeetingsModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOnlineStatus.mockReturnValue({ isOnline: true });
    mockUseGcMeetings.mockReturnValue({
      meetings: [meeting],
      isLoading: false,
      isError: false,
    });
    mockUseGcMeetingPdfUrl.mockReturnValue({
      openPdf: mockOpenPdf,
      isPending: false,
    });
  });

  it("is closed when no sub is selected", () => {
    renderModal({ sub: undefined });
    expect(screen.queryByText("Fall Protection")).toBeNull();
  });

  it("passes the sub's projectId to useGcMeetings, enabled", () => {
    renderModal();
    expect(mockUseGcMeetings).toHaveBeenCalledWith(
      { projectId: "project-1" },
      true,
    );
  });

  it("makes no request for a sub with no project to drill into", () => {
    renderModal({ sub: { ...sub, projectId: null } });
    expect(mockUseGcMeetings).toHaveBeenCalledWith(
      { projectId: undefined },
      false,
    );
  });

  it("shows a loading spinner while meetings are loading", () => {
    mockUseGcMeetings.mockReturnValue({
      meetings: [],
      isLoading: true,
      isError: false,
    });
    renderModal();
    expect(screen.getByText(/loading recent logs/i)).toBeDefined();
  });

  it("shows an error message when the meetings fail to load", () => {
    mockUseGcMeetings.mockReturnValue({
      meetings: [],
      isLoading: false,
      isError: true,
    });
    renderModal();
    expect(screen.getByRole("alert")).toBeDefined();
  });

  it("shows an empty state when there are no completed logs", () => {
    mockUseGcMeetings.mockReturnValue({
      meetings: [],
      isLoading: false,
      isError: false,
    });
    renderModal();
    expect(screen.getByText(/no completed talks logged yet/i)).toBeDefined();
  });

  it("renders each meeting with its talk title and signer count", () => {
    renderModal();
    expect(screen.getByText("Fall Protection")).toBeDefined();
    expect(screen.getByText(/2 signers/i)).toBeDefined();
  });

  it("falls back to a placeholder title and uses singular 'signer' for one signer", () => {
    mockUseGcMeetings.mockReturnValue({
      meetings: [{ ...meeting, talkTitle: null, signerCount: 1 }],
      isLoading: false,
      isError: false,
    });
    renderModal();

    expect(screen.getByText("Untitled talk")).toBeDefined();
    expect(screen.getByText(/1 signer$/i)).toBeDefined();
  });

  it("calls openPdf when Open PDF is clicked for a ready meeting", () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: /open pdf/i }));
    expect(mockOpenPdf).toHaveBeenCalledWith("meeting-1");
  });

  it("disables the action and shows 'PDF pending' when the PDF isn't ready", () => {
    mockUseGcMeetings.mockReturnValue({
      meetings: [{ ...meeting, pdfReady: false }],
      isLoading: false,
      isError: false,
    });
    renderModal();

    const button = screen.getByRole("button", { name: /pdf pending/i });
    expect(button).toHaveProperty("disabled", true);
  });

  it("shows an offline note and disables Open PDF while offline", () => {
    mockUseOnlineStatus.mockReturnValue({ isOnline: false });
    renderModal();

    expect(screen.getByText(/you're offline/i)).toBeDefined();
    const button = screen.getByRole("button", { name: /open pdf/i });
    expect(button).toHaveProperty("disabled", true);
  });
});
