import React from "react";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { describe, expect, it, vi } from "vitest";

import { InstallInstructionsModal } from "../../../src/features/pwa-install/InstallInstructionsModal";
import theme from "../../../src/styles/theme";
import type { InstallPlatform } from "../../../src/interfaces/pwa";

const mockUsePwaInstall = vi.fn();
vi.mock("../../../src/context/pwa-install", () => ({
  usePwaInstall: () => mockUsePwaInstall(),
}));

const renderModal = (platform: InstallPlatform, isOpen = true) => {
  mockUsePwaInstall.mockReturnValue({ platform });
  return render(
    <ThemeProvider theme={theme}>
      <InstallInstructionsModal isOpen={isOpen} onClose={vi.fn()} />
    </ThemeProvider>,
  );
};

describe("InstallInstructionsModal", () => {
  it("renders nothing when closed", () => {
    renderModal("ios-safari", false);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the Safari Share steps and the Safari-only note on iOS", () => {
    renderModal("ios-safari");

    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText(/tap the share button/i)).toBeDefined();
    expect(screen.getByText(/add to home screen/i)).toBeDefined();
    expect(screen.getByText(/only safari can install/i)).toBeDefined();
  });

  it("tells in-app webview users to open the page in a real browser", () => {
    renderModal("in-app");

    expect(
      screen.getByText(/open tailgatepro in your browser to install it/i),
    ).toBeDefined();
    expect(screen.getByText(/open in browser/i)).toBeDefined();
  });

  it("tells Firefox desktop users which browsers can install", () => {
    renderModal("desktop-firefox");

    expect(
      screen.getByText(/this browser can't install tailgatepro/i),
    ).toBeDefined();
    expect(
      screen.getByText(/open this page in chrome, microsoft edge, or safari/i),
    ).toBeDefined();
  });

  it("renders the menu-style guide for Android Chrome", () => {
    renderModal("android-chromium");
    expect(screen.getByText(/tap the ⋮ menu in the top-right/i)).toBeDefined();
    expect(
      screen.getByText(/add to home screen.*install app/i),
    ).toBeDefined();
  });

  it("renders the dock-style guide for macOS Safari", () => {
    renderModal("macos-safari");
    expect(screen.getByText(/add tailgatepro to your dock/i)).toBeDefined();
    expect(screen.getByText(/add to dock/i)).toBeDefined();
  });
});
