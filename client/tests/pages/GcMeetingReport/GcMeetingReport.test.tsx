import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "styled-components";

import { GcMeetingReport } from "../../../src/pages/GcMeetingReport/GcMeetingReport";
import theme from "../../../src/styles/theme";

const mockOpenPdf = vi.fn();
const mockUseGcMeetingPdfUrl = vi.fn();

vi.mock("../../../src/hooks/useGcMeetingPdfUrl", () => ({
  useGcMeetingPdfUrl: () => mockUseGcMeetingPdfUrl(),
}));
vi.mock("../../../src/ui_comps/footer", () => ({ Footer: () => null }));

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider theme={theme}>
        <Routes>
          <Route path="/gc/meetings/:id/report" element={<GcMeetingReport />} />
          <Route path="/gc/meetings/report" element={<GcMeetingReport />} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>,
  );

describe("GcMeetingReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGcMeetingPdfUrl.mockReturnValue({ openPdf: mockOpenPdf, isPending: false });
  });

  it("requests a fresh PDF link once on mount", () => {
    renderAt("/gc/meetings/meeting-1/report");

    expect(mockOpenPdf).toHaveBeenCalledTimes(1);
    expect(mockOpenPdf).toHaveBeenCalledWith("meeting-1");
  });

  it("lets the user retry with the Open report button", () => {
    renderAt("/gc/meetings/meeting-1/report");

    fireEvent.click(screen.getByRole("button", { name: /open report/i }));

    expect(mockOpenPdf).toHaveBeenCalledTimes(2);
  });

  it("shows an opening message while the link is being fetched", () => {
    mockUseGcMeetingPdfUrl.mockReturnValue({ openPdf: mockOpenPdf, isPending: true });
    renderAt("/gc/meetings/meeting-1/report");

    expect(screen.getByRole("status").textContent).toMatch(/opening the report/i);
  });

  it("does nothing and disables the button when there is no meeting id", () => {
    renderAt("/gc/meetings/report");

    expect(mockOpenPdf).not.toHaveBeenCalled();
    const button = screen.getByRole("button", { name: /open report/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});
