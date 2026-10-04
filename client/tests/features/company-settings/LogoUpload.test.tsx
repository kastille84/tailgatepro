import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LogoUpload } from "../../../src/features/company-settings";
import theme from "../../../src/styles/theme";

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

// jsdom has no real createObjectURL/revokeObjectURL implementation.
const createObjectURL = vi.fn(() => "blob:mock-url");
const revokeObjectURL = vi.fn();

const makeFile = (name = "logo.png") =>
  new File(["fake-bytes"], name, { type: "image/png" });

beforeEach(() => {
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LogoUpload", () => {
  it("shows an empty placeholder and an 'Upload logo' label when no logo exists yet", () => {
    renderWithTheme(
      <LogoUpload currentLogoUrl={null} isUploading={false} onUpload={vi.fn()} />,
    );

    expect(screen.getByText(/no logo uploaded yet/i)).toBeDefined();
    expect(screen.getByText(/^upload logo$/i)).toBeDefined();
  });

  it("shows the current logo and a 'Change logo' label when one exists", () => {
    renderWithTheme(
      <LogoUpload
        currentLogoUrl="https://signed.example/logo.png"
        isUploading={false}
        onUpload={vi.fn()}
      />,
    );

    expect(screen.getByAltText(/company logo/i)).toHaveProperty(
      "src",
      "https://signed.example/logo.png",
    );
    expect(screen.getByText(/change logo/i)).toBeDefined();
  });

  it("previews a newly chosen file and offers Save/Cancel before uploading", () => {
    renderWithTheme(
      <LogoUpload currentLogoUrl={null} isUploading={false} onUpload={vi.fn()} />,
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile()] } });

    expect(screen.getByAltText(/company logo/i)).toHaveProperty(
      "src",
      "blob:mock-url",
    );
    expect(screen.getByRole("button", { name: /save logo/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDefined();
  });

  it("does nothing when the change event carries no file", () => {
    renderWithTheme(
      <LogoUpload currentLogoUrl={null} isUploading={false} onUpload={vi.fn()} />,
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [] } });

    expect(screen.queryByRole("button", { name: /save logo/i })).toBeNull();
  });

  it("calls onUpload with the chosen file and clears the pending preview on save", async () => {
    const onUpload = vi.fn().mockResolvedValue(undefined);
    renderWithTheme(
      <LogoUpload currentLogoUrl={null} isUploading={false} onUpload={onUpload} />,
    );

    const file = makeFile();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: /save logo/i }));

    expect(onUpload).toHaveBeenCalledWith(file);
    await vi.waitFor(() =>
      expect(screen.queryByRole("button", { name: /save logo/i })).toBeNull(),
    );
    expect(screen.getByText(/^upload logo$/i)).toBeDefined();
  });

  it("keeps the pending preview so the worker can retry when onUpload rejects", async () => {
    const onUpload = vi.fn().mockRejectedValue(new Error("boom"));
    renderWithTheme(
      <LogoUpload currentLogoUrl={null} isUploading={false} onUpload={onUpload} />,
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile()] } });
    fireEvent.click(screen.getByRole("button", { name: /save logo/i }));

    await vi.waitFor(() => expect(onUpload).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: /save logo/i })).toBeDefined();
  });

  it("discards the pending preview and revokes its object URL on cancel", () => {
    renderWithTheme(
      <LogoUpload currentLogoUrl={null} isUploading={false} onUpload={vi.fn()} />,
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile()] } });

    revokeObjectURL.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/^upload logo$/i)).toBeDefined();
  });

  it("revokes the pending preview URL on unmount", () => {
    const { unmount } = renderWithTheme(
      <LogoUpload currentLogoUrl={null} isUploading={false} onUpload={vi.fn()} />,
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile()] } });

    revokeObjectURL.mockClear();
    unmount();
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it("disables Save/Cancel and shows a loading state on the Save button while uploading", () => {
    renderWithTheme(
      <LogoUpload currentLogoUrl={null} isUploading={true} onUpload={vi.fn()} />,
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile()] } });

    expect(screen.getByRole("button", { name: /save logo/i })).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByRole("button", { name: /cancel/i })).toHaveProperty(
      "disabled",
      true,
    );
  });
});
