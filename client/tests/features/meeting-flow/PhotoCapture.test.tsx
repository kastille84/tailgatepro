import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PhotoCapture } from "../../../src/features/meeting-flow";
import theme from "../../../src/styles/theme";

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

// jsdom has no real createObjectURL/revokeObjectURL implementation.
const createObjectURL = vi.fn(() => "blob:mock-url");
const revokeObjectURL = vi.fn();

beforeEach(() => {
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const makeFile = (name = "crew.jpg") =>
  new File(["fake-bytes"], name, { type: "image/jpeg" });

describe("PhotoCapture", () => {
  it("always shows the BIPA-adjacent compliance notice", () => {
    renderWithTheme(<PhotoCapture onCapture={vi.fn()} onSkip={vi.fn()} />);
    expect(
      screen.getByText(/not analyzed or matched against any facial-recognition/i),
    ).toBeDefined();
    expect(screen.getByText(/optional/i)).toBeDefined();
  });

  it("shows no preview and a Take-photo label before a file is chosen", () => {
    renderWithTheme(<PhotoCapture onCapture={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByText(/take crew photo/i)).toBeDefined();
    expect(screen.queryByAltText(/captured crew photo/i)).toBeNull();
  });

  it("calls onCapture with the chosen file and renders a preview", () => {
    const onCapture = vi.fn();
    renderWithTheme(<PhotoCapture onCapture={onCapture} onSkip={vi.fn()} />);

    const file = makeFile();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    expect(onCapture).toHaveBeenCalledWith(file);
    expect(screen.getByAltText(/captured crew photo/i)).toBeDefined();
    expect(screen.getByText(/retake photo/i)).toBeDefined();
  });

  it("revokes the previous preview URL when a new photo replaces it", () => {
    renderWithTheme(<PhotoCapture onCapture={vi.fn()} onSkip={vi.fn()} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [makeFile("first.jpg")] } });
    fireEvent.change(input, { target: { files: [makeFile("second.jpg")] } });

    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the change event carries no file", () => {
    const onCapture = vi.fn();
    renderWithTheme(<PhotoCapture onCapture={onCapture} onSkip={vi.fn()} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [] } });

    expect(onCapture).not.toHaveBeenCalled();
    expect(screen.queryByAltText(/captured crew photo/i)).toBeNull();
  });

  it("calls onSkip when the skip button is clicked", () => {
    const onSkip = vi.fn();
    renderWithTheme(<PhotoCapture onCapture={vi.fn()} onSkip={onSkip} />);

    fireEvent.click(screen.getByRole("button", { name: /skip photo/i }));
    expect(onSkip).toHaveBeenCalled();
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
