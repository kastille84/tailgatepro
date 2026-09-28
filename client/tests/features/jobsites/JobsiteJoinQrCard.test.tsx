import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import toast from "react-hot-toast";
import QRCode from "qrcode";

import { JobsiteJoinQrCard } from "../../../src/features/jobsites/JobsiteJoinQrCard";
import { triggerBrowserDownload } from "../../../src/utils/triggerBrowserDownload";
import theme from "../../../src/styles/theme";

vi.mock("react-hot-toast");
vi.mock("qrcode", () => ({ default: { toCanvas: vi.fn() } }));
vi.mock("../../../src/utils/triggerBrowserDownload", () => ({
  triggerBrowserDownload: vi.fn(),
}));

const mockUseJobsiteJoinLink = vi.fn();
vi.mock("../../../src/hooks/useJobsiteJoinLink", () => ({
  useJobsiteJoinLink: () => mockUseJobsiteJoinLink(),
}));

const setClipboard = (clipboard: unknown) =>
  Object.defineProperty(navigator, "clipboard", {
    value: clipboard,
    configurable: true,
  });

const renderCard = (
  props: Partial<React.ComponentProps<typeof JobsiteJoinQrCard>> = {},
) =>
  render(
    <ThemeProvider theme={theme}>
      <JobsiteJoinQrCard jobsiteId="j1" jobsiteName="Riverside Tower" {...props} />
    </ThemeProvider>,
  );

describe("JobsiteJoinQrCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseJobsiteJoinLink.mockReturnValue({
      joinUrl: "https://app.example.com/jobsite-join/tok",
      isLoading: false,
      isError: false,
    });
    vi.mocked(QRCode.toCanvas).mockResolvedValue(undefined as never);
    setClipboard({ writeText: vi.fn().mockResolvedValue(undefined) });
  });

  afterEach(() => {
    setClipboard(undefined);
  });

  it("shows a loading indicator and no controls while loading", () => {
    mockUseJobsiteJoinLink.mockReturnValue({ joinUrl: null, isLoading: true, isError: false });

    renderCard();

    expect(screen.getByText(/loading this job site's qr code/i)).toBeDefined();
    expect(screen.queryByRole("button", { name: /copy link/i })).toBeNull();
  });

  it("shows an error and no controls when the link could not be loaded", () => {
    mockUseJobsiteJoinLink.mockReturnValue({ joinUrl: null, isLoading: false, isError: true });

    renderCard();

    expect(screen.getByRole("alert").textContent).toMatch(/could not load the qr code/i);
    expect(screen.queryByRole("button", { name: /copy link/i })).toBeNull();
  });

  it("draws the QR code onto the canvas and shows the link text and actions", async () => {
    renderCard();

    await waitFor(() =>
      expect(QRCode.toCanvas).toHaveBeenCalledWith(
        expect.any(HTMLCanvasElement),
        "https://app.example.com/jobsite-join/tok",
        expect.objectContaining({ width: 180 }),
      ),
    );
    expect(screen.getByText("https://app.example.com/jobsite-join/tok")).toBeDefined();
    expect(
      screen.getByRole("img", { name: /qr code linking to join riverside tower/i }),
    ).toBeDefined();
    expect(screen.getByRole("button", { name: /copy link/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /download qr/i })).toBeDefined();
  });

  it("toasts an error when the QR code fails to render", async () => {
    vi.mocked(QRCode.toCanvas).mockRejectedValue(new Error("boom"));

    renderCard();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Could not render the QR code."),
    );
  });

  it("copies the join link to the clipboard and confirms with a toast", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: /copy link/i }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Join link copied"));
    expect(writeText).toHaveBeenCalledWith("https://app.example.com/jobsite-join/tok");
  });

  it("tells the user to copy manually when the clipboard write is rejected", async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error("denied")) });
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: /copy link/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Could not copy. Select the link and copy it manually.",
      ),
    );
  });

  it("downloads the QR as a PNG named after the job site", async () => {
    const blob = new Blob(["fake"], { type: "image/png" });
    const toBlobSpy = vi
      .spyOn(HTMLCanvasElement.prototype, "toBlob")
      .mockImplementation((cb) => cb(blob));
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: /download qr/i }));

    await waitFor(() =>
      expect(triggerBrowserDownload).toHaveBeenCalledWith(blob, "riverside-tower-join-qr.png"),
    );
    toBlobSpy.mockRestore();
  });

  it("falls back to a generic filename when the job site name slugifies to nothing", async () => {
    const blob = new Blob(["fake"], { type: "image/png" });
    const toBlobSpy = vi
      .spyOn(HTMLCanvasElement.prototype, "toBlob")
      .mockImplementation((cb) => cb(blob));
    renderCard({ jobsiteName: "!!!" });

    fireEvent.click(screen.getByRole("button", { name: /download qr/i }));

    await waitFor(() =>
      expect(triggerBrowserDownload).toHaveBeenCalledWith(blob, "job-site-join-qr.png"),
    );
    toBlobSpy.mockRestore();
  });

  it("toasts an error when the canvas has nothing to export", async () => {
    const toBlobSpy = vi
      .spyOn(HTMLCanvasElement.prototype, "toBlob")
      .mockImplementation((cb) => cb(null));
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: /download qr/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Could not download the QR code."),
    );
    expect(triggerBrowserDownload).not.toHaveBeenCalled();
    toBlobSpy.mockRestore();
  });
});
