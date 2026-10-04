import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PhotoCapture } from "../../../src/features/meeting-flow";
import theme from "../../../src/styles/theme";

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

// jsdom has no real createObjectURL/revokeObjectURL implementation.
const createObjectURL = vi.fn(() => "blob:mock-url");
const revokeObjectURL = vi.fn();

// jsdom has no real 2D canvas context or media playback -- stubbed per-test
// as needed, restored afterward so other suites aren't affected.
const originalGetContext = HTMLCanvasElement.prototype.getContext;
const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;

const makeFile = (name = "crew.jpg") =>
  new File(["fake-bytes"], name, { type: "image/jpeg" });

const trackStop = vi.fn();
const fakeStream = {
  getTracks: () => [{ stop: trackStop }],
} as unknown as MediaStream;

/** Installs (or removes) `navigator.mediaDevices.getUserMedia` for a test --
 *  jsdom has no real implementation, so it's undefined by default, which
 *  already exercises the "unsupported" fallback path with no setup at all. */
const setCameraSupport = (getUserMedia?: ReturnType<typeof vi.fn>) => {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: getUserMedia ? { getUserMedia } : undefined,
  });
};

const stubCanvas = () => {
  const drawImage = vi.fn();
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => ({ drawImage }) as unknown as CanvasRenderingContext2D,
  ) as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toDataURL = vi.fn(
    () => "data:image/jpeg;base64,ZmFrZQ==",
  );
  return { drawImage };
};

/** Marks a live-camera <video> element as ready and fires the event
 *  PhotoCapture listens for to enable the Capture button -- jsdom never
 *  actually loads media, so videoWidth/videoHeight must be forced. */
const markVideoReady = (video: HTMLVideoElement) => {
  Object.defineProperty(video, "videoWidth", { value: 640, configurable: true });
  Object.defineProperty(video, "videoHeight", { value: 480, configurable: true });
  fireEvent.loadedMetadata(video);
};

beforeEach(() => {
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  trackStop.mockClear();
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  HTMLMediaElement.prototype.pause = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
  setCameraSupport(undefined);
  HTMLCanvasElement.prototype.getContext = originalGetContext;
  HTMLCanvasElement.prototype.toDataURL = originalToDataURL;
});

describe("PhotoCapture", () => {
  it("always shows the BIPA-adjacent compliance notice", () => {
    renderWithTheme(<PhotoCapture onCapture={vi.fn()} onSkip={vi.fn()} />);
    expect(
      screen.getByText(/not analyzed or matched against any facial-recognition/i),
    ).toBeDefined();
    expect(screen.getByText(/optional/i)).toBeDefined();
  });

  it("calls onSkip when the skip button is clicked", () => {
    const onSkip = vi.fn();
    renderWithTheme(<PhotoCapture onCapture={vi.fn()} onSkip={onSkip} />);

    fireEvent.click(screen.getByRole("button", { name: /skip photo/i }));
    expect(onSkip).toHaveBeenCalled();
  });

  describe("without camera support (getUserMedia unavailable)", () => {
    it("shows the file-picker fallback immediately, no preview", () => {
      renderWithTheme(<PhotoCapture onCapture={vi.fn()} onSkip={vi.fn()} />);
      expect(screen.getByText(/choose a photo/i)).toBeDefined();
      expect(screen.queryByAltText(/captured crew photo/i)).toBeNull();
    });

    it("calls onCapture with the chosen file and renders a preview", () => {
      const onCapture = vi.fn();
      renderWithTheme(<PhotoCapture onCapture={onCapture} onSkip={vi.fn()} />);

      const file = makeFile();
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [file] } });
      fireEvent.click(screen.getByRole("button", { name: /use photo/i }));

      expect(onCapture).toHaveBeenCalledWith(file);
      expect(screen.getByAltText(/captured crew photo/i)).toBeDefined();
      expect(screen.getByRole("button", { name: /retake photo/i })).toBeDefined();
    });

    it("does nothing when the change event carries no file", () => {
      const onCapture = vi.fn();
      renderWithTheme(<PhotoCapture onCapture={onCapture} onSkip={vi.fn()} />);
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [] } });

      expect(onCapture).not.toHaveBeenCalled();
      expect(screen.queryByAltText(/captured crew photo/i)).toBeNull();
    });

    it("revokes the preview URL once retake re-opens the fallback picker", () => {
      renderWithTheme(<PhotoCapture onCapture={vi.fn()} onSkip={vi.fn()} />);
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [makeFile("first.jpg")] } });

      revokeObjectURL.mockClear();
      fireEvent.click(screen.getByRole("button", { name: /retake photo/i }));

      expect(revokeObjectURL).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/choose a photo/i)).toBeDefined();
    });

    it("revokes the preview URL on unmount", () => {
      const { unmount } = renderWithTheme(
        <PhotoCapture onCapture={vi.fn()} onSkip={vi.fn()} />,
      );
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [makeFile()] } });

      revokeObjectURL.mockClear();
      unmount();
      expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    });
  });

  describe("with camera support (getUserMedia available)", () => {
    it("opens a live preview and captures a snapshot as a File", async () => {
      const getUserMedia = vi.fn().mockResolvedValue(fakeStream);
      setCameraSupport(getUserMedia);
      stubCanvas();
      const onCapture = vi.fn();

      renderWithTheme(<PhotoCapture onCapture={onCapture} onSkip={vi.fn()} />);
      fireEvent.click(screen.getByRole("button", { name: /take crew photo/i }));

      await waitFor(() => expect(getUserMedia).toHaveBeenCalled());
      const video = document.querySelector("video") as HTMLVideoElement;
      expect(video).not.toBeNull();

      const captureButton = screen.getByRole("button", { name: /^capture$/i });
      expect(captureButton).toHaveProperty("disabled", true);

      markVideoReady(video);
      expect(captureButton).toHaveProperty("disabled", false);

      fireEvent.click(captureButton);
      fireEvent.click(screen.getByRole("button", { name: /use photo/i }));

      expect(onCapture).toHaveBeenCalledTimes(1);
      const file = onCapture.mock.calls[0][0] as File;
      expect(file).toBeInstanceOf(File);
      expect(file.type).toBe("image/jpeg");
      expect(file.name).toBe("crew-photo.jpg");
      expect(trackStop).toHaveBeenCalledTimes(1);
      expect(screen.getByAltText(/captured crew photo/i)).toBeDefined();
    });

    it("re-opens the live camera on retake", async () => {
      const getUserMedia = vi.fn().mockResolvedValue(fakeStream);
      setCameraSupport(getUserMedia);
      stubCanvas();

      renderWithTheme(<PhotoCapture onCapture={vi.fn()} onSkip={vi.fn()} />);
      fireEvent.click(screen.getByRole("button", { name: /take crew photo/i }));
      await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
      markVideoReady(document.querySelector("video") as HTMLVideoElement);
      fireEvent.click(screen.getByRole("button", { name: /^capture$/i }));

      revokeObjectURL.mockClear();
      fireEvent.click(screen.getByRole("button", { name: /retake photo/i }));

      await waitFor(() => {
        expect(getUserMedia).toHaveBeenCalledTimes(2);
        expect(document.querySelector("video")).not.toBeNull();
      });
      expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    });

    it("stops the stream and returns to idle when camera is cancelled", async () => {
      const getUserMedia = vi.fn().mockResolvedValue(fakeStream);
      setCameraSupport(getUserMedia);

      renderWithTheme(<PhotoCapture onCapture={vi.fn()} onSkip={vi.fn()} />);
      fireEvent.click(screen.getByRole("button", { name: /take crew photo/i }));
      await waitFor(() => expect(getUserMedia).toHaveBeenCalled());

      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

      expect(trackStop).toHaveBeenCalledTimes(1);
      expect(document.querySelector("video")).toBeNull();
      expect(screen.getByRole("button", { name: /take crew photo/i })).toBeDefined();
    });

    it("stops the stream when skip is clicked mid-camera", async () => {
      const getUserMedia = vi.fn().mockResolvedValue(fakeStream);
      setCameraSupport(getUserMedia);
      const onSkip = vi.fn();

      renderWithTheme(<PhotoCapture onCapture={vi.fn()} onSkip={onSkip} />);
      fireEvent.click(screen.getByRole("button", { name: /take crew photo/i }));
      await waitFor(() => expect(getUserMedia).toHaveBeenCalled());

      fireEvent.click(screen.getByRole("button", { name: /skip photo/i }));

      expect(trackStop).toHaveBeenCalledTimes(1);
      expect(onSkip).toHaveBeenCalled();
    });

    it("stops the stream on unmount while the camera is open", async () => {
      const getUserMedia = vi.fn().mockResolvedValue(fakeStream);
      setCameraSupport(getUserMedia);

      const { unmount } = renderWithTheme(
        <PhotoCapture onCapture={vi.fn()} onSkip={vi.fn()} />,
      );
      fireEvent.click(screen.getByRole("button", { name: /take crew photo/i }));
      await waitFor(() => expect(getUserMedia).toHaveBeenCalled());

      unmount();
      expect(trackStop).toHaveBeenCalledTimes(1);
    });

    it("falls back to the file picker when getUserMedia is rejected", async () => {
      const getUserMedia = vi.fn().mockRejectedValue(new Error("Permission denied"));
      setCameraSupport(getUserMedia);

      renderWithTheme(<PhotoCapture onCapture={vi.fn()} onSkip={vi.fn()} />);
      fireEvent.click(screen.getByRole("button", { name: /take crew photo/i }));

      await waitFor(() =>
        expect(screen.getByLabelText(/choose a photo/i)).toBeDefined(),
      );
      expect(screen.getByText(/camera unavailable/i)).toBeDefined();
      expect(document.querySelector("video")).toBeNull();
    });

    it("falls back to the file picker when no 2D canvas context is available", async () => {
      const getUserMedia = vi.fn().mockResolvedValue(fakeStream);
      setCameraSupport(getUserMedia);
      HTMLCanvasElement.prototype.getContext = vi.fn(
        () => null,
      ) as typeof HTMLCanvasElement.prototype.getContext;
      const onCapture = vi.fn();

      renderWithTheme(<PhotoCapture onCapture={onCapture} onSkip={vi.fn()} />);
      fireEvent.click(screen.getByRole("button", { name: /take crew photo/i }));
      await waitFor(() => expect(getUserMedia).toHaveBeenCalled());
      markVideoReady(document.querySelector("video") as HTMLVideoElement);

      fireEvent.click(screen.getByRole("button", { name: /^capture$/i }));

      expect(onCapture).not.toHaveBeenCalled();
      expect(trackStop).toHaveBeenCalledTimes(1);
      expect(screen.getByLabelText(/choose a photo/i)).toBeDefined();
    });
  });
});
