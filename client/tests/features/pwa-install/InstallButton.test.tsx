import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { InstallButton } from "../../../src/features/pwa-install";
import theme from "../../../src/styles/theme";
import type { PwaInstallState } from "../../../src/context/pwa-install";

const mockUsePwaInstall = vi.fn();
vi.mock("../../../src/context/pwa-install", () => ({
  usePwaInstall: () => mockUsePwaInstall(),
}));

type Ctx = PwaInstallState & {
  promptInstall: ReturnType<typeof vi.fn>;
  dismiss: ReturnType<typeof vi.fn>;
  resetDismissed: ReturnType<typeof vi.fn>;
};

const makeCtx = (overrides: Partial<Ctx> = {}): Ctx => ({
  isStandalone: false,
  canPrompt: false,
  platform: "ios-safari",
  installability: "manual",
  wasDismissed: false,
  promptInstall: vi.fn().mockResolvedValue("accepted"),
  dismiss: vi.fn(),
  resetDismissed: vi.fn(),
  ...overrides,
});

const renderButton = () =>
  render(
    <ThemeProvider theme={theme}>
      <InstallButton />
    </ThemeProvider>,
  );

describe("InstallButton", () => {
  beforeEach(() => {
    mockUsePwaInstall.mockReturnValue(makeCtx());
  });

  it("renders nothing when the app is already installed", () => {
    mockUsePwaInstall.mockReturnValue(makeCtx({ isStandalone: true }));
    renderButton();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("fires the native prompt when one is available and does not open instructions", async () => {
    const ctx = makeCtx({ canPrompt: true });
    mockUsePwaInstall.mockReturnValue(ctx);
    renderButton();

    fireEvent.click(screen.getByRole("button", { name: /install app/i }));

    await waitFor(() => expect(ctx.promptInstall).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens and closes the instructions modal when there is no native prompt", () => {
    mockUsePwaInstall.mockReturnValue(makeCtx({ canPrompt: false }));
    renderButton();

    fireEvent.click(screen.getByRole("button", { name: /install app/i }));

    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText(/add to home screen/i)).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /close dialog/i }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("falls back to instructions if the stashed prompt has gone stale", async () => {
    const ctx = makeCtx({
      canPrompt: true,
      promptInstall: vi.fn().mockResolvedValue("unavailable"),
    });
    mockUsePwaInstall.mockReturnValue(ctx);
    renderButton();

    fireEvent.click(screen.getByRole("button", { name: /install app/i }));

    await waitFor(() => expect(screen.getByRole("dialog")).toBeDefined());
  });
});
