import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "styled-components";

import { VerifyMeeting } from "../../../src/pages/VerifyMeeting/VerifyMeeting";
import theme from "../../../src/styles/theme";

const mockUsePublicSealStatus = vi.fn();
const mockUseVerifyPdfFile = vi.fn();
const mockCheckFile = vi.fn();

vi.mock("../../../src/hooks/usePublicSealStatus", () => ({
  usePublicSealStatus: (id: string | undefined) => mockUsePublicSealStatus(id),
}));
vi.mock("../../../src/hooks/useVerifyPdfFile", () => ({
  useVerifyPdfFile: (id: string | undefined) => mockUseVerifyPdfFile(id),
}));
vi.mock("../../../src/ui_comps/footer", () => ({ Footer: () => null }));

const validStatus = {
  sealed: true,
  valid: true,
  sealedAt: "2026-09-21T13:05:00.000Z",
  fileFingerprint: true,
  imageMismatchCount: 0,
};

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider theme={theme}>
        <Routes>
          <Route path="/verify/:id" element={<VerifyMeeting />} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>,
  );

const chooseFile = (file?: File) => {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: file ? [file] : [] } });
};

describe("VerifyMeeting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePublicSealStatus.mockReturnValue({
      status: validStatus,
      isLoading: false,
      error: null,
    });
    mockUseVerifyPdfFile.mockReturnValue({
      checkFile: mockCheckFile,
      result: undefined,
      error: null,
      isPending: false,
    });
  });

  it("looks up the meeting from the URL", () => {
    renderAt("/verify/meeting-1");

    expect(mockUsePublicSealStatus).toHaveBeenCalledWith("meeting-1");
    expect(mockUseVerifyPdfFile).toHaveBeenCalledWith("meeting-1");
  });

  it("shows a spinner while the records are being checked, and no file check yet", () => {
    mockUsePublicSealStatus.mockReturnValue({
      status: undefined,
      isLoading: true,
      error: null,
    });
    renderAt("/verify/meeting-1");

    expect(screen.getByLabelText("Checking the records…")).toBeDefined();
    expect(screen.queryByText("Check a PDF file")).toBeNull();
  });

  it("shows the server's message when the meeting can't be verified", () => {
    mockUsePublicSealStatus.mockReturnValue({
      status: undefined,
      isLoading: false,
      error: new Error("This meeting hasn't been sealed yet"),
    });
    renderAt("/verify/meeting-1");

    expect(screen.getByRole("alert").textContent).toMatch(/hasn't been sealed yet/i);
  });

  it("reports matching records", () => {
    renderAt("/verify/meeting-1");

    expect(screen.getByText("Records match what was sealed.")).toBeDefined();
  });

  it("reports mismatching records, singular image count", () => {
    mockUsePublicSealStatus.mockReturnValue({
      status: { ...validStatus, valid: false, imageMismatchCount: 1 },
      isLoading: false,
      error: null,
    });
    renderAt("/verify/meeting-1");

    expect(screen.getByText("Records no longer match what was sealed.")).toBeDefined();
    expect(screen.getByText(/^1 image in this report has been replaced/)).toBeDefined();
  });

  it("reports a plural image count", () => {
    mockUsePublicSealStatus.mockReturnValue({
      status: { ...validStatus, valid: false, imageMismatchCount: 3 },
      isLoading: false,
      error: null,
    });
    renderAt("/verify/meeting-1");

    expect(screen.getByText(/^3 images in this report have been replaced/)).toBeDefined();
  });

  it("explains that only the records can be checked for an older report with no file fingerprint", () => {
    mockUsePublicSealStatus.mockReturnValue({
      status: { ...validStatus, fileFingerprint: false },
      isLoading: false,
      error: null,
    });
    renderAt("/verify/meeting-1");

    expect(screen.getByText(/sealed before file checking was available/i)).toBeDefined();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it("sends a chosen PDF to be checked and clears the input so the same file can be re-checked", () => {
    renderAt("/verify/meeting-1");
    const file = new File(["%PDF"], "report.pdf", { type: "application/pdf" });

    chooseFile(file);

    expect(mockCheckFile).toHaveBeenCalledWith(file);
  });

  it("ignores a cancelled file dialog", () => {
    renderAt("/verify/meeting-1");

    chooseFile(undefined);

    expect(mockCheckFile).not.toHaveBeenCalled();
  });

  it("disables the picker and says it is checking while the file is in flight", () => {
    mockUseVerifyPdfFile.mockReturnValue({
      checkFile: mockCheckFile,
      result: undefined,
      error: null,
      isPending: true,
    });
    renderAt("/verify/meeting-1");

    expect(screen.getByText("Checking…")).toBeDefined();
    expect((document.querySelector('input[type="file"]') as HTMLInputElement).disabled).toBe(true);
  });

  it("shows the file check error", () => {
    mockUseVerifyPdfFile.mockReturnValue({
      checkFile: mockCheckFile,
      result: undefined,
      error: new Error("Something went wrong. Please try again."),
      isPending: false,
    });
    renderAt("/verify/meeting-1");

    expect(screen.getByRole("alert").textContent).toMatch(/something went wrong/i);
  });

  it.each([
    ["current", /original report/i, /byte-for-byte identical/i],
    ["superseded", /earlier copy/i, /regenerated/i],
    ["no-match", /does not match/i, /may have been edited/i],
    ["record-altered", /integrity check/i, /cannot be trusted/i],
  ] as const)("shows the %s verdict", (status, headline, detail) => {
    mockUseVerifyPdfFile.mockReturnValue({
      checkFile: mockCheckFile,
      result: { matches: status === "current" || status === "superseded", status },
      error: null,
      isPending: false,
    });
    renderAt("/verify/meeting-1");

    expect(screen.getByText(headline)).toBeDefined();
    expect(screen.getByText(detail)).toBeDefined();
  });
});
