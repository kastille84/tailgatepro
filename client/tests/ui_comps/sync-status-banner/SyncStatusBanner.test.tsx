import React from "react";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { describe, expect, it, vi } from "vitest";

const mockUseOnlineStatus = vi.fn();
vi.mock("../../../src/context/online-status", () => ({
  useOnlineStatus: () => mockUseOnlineStatus(),
}));

import { SyncStatusBanner } from "../../../src/ui_comps/sync-status-banner";
import theme from "../../../src/styles/theme";

const renderWithTheme = () =>
  render(
    <ThemeProvider theme={theme}>
      <SyncStatusBanner />
    </ThemeProvider>,
  );

describe("SyncStatusBanner", () => {
  it("renders nothing when online with nothing queued", () => {
    mockUseOnlineStatus.mockReturnValue({
      isOnline: true,
      pendingCount: 0,
      retryNow: vi.fn(),
    });

    const { container } = renderWithTheme();
    expect(container.firstChild).toBeNull();
  });

  it("shows an offline message when offline with nothing queued", () => {
    mockUseOnlineStatus.mockReturnValue({
      isOnline: false,
      pendingCount: 0,
      retryNow: vi.fn(),
    });

    renderWithTheme();
    expect(screen.getByRole("status").textContent).toMatch(/you.re offline/i);
    expect(
      screen.queryByRole("button", { name: /retry now/i }),
    ).toBeNull();
  });

  it("mentions the queued count while offline", () => {
    mockUseOnlineStatus.mockReturnValue({
      isOnline: false,
      pendingCount: 2,
      retryNow: vi.fn(),
    });

    renderWithTheme();
    expect(screen.getByRole("status").textContent).toMatch(/2 waiting/i);
  });

  it("shows a singular count and a working retry button when online with pending rows", () => {
    const retryNow = vi.fn();
    mockUseOnlineStatus.mockReturnValue({
      isOnline: true,
      pendingCount: 1,
      retryNow,
    });

    renderWithTheme();
    expect(screen.getByRole("status").textContent).toMatch(
      /1 change waiting to sync/i,
    );

    screen.getByRole("button", { name: /retry now/i }).click();
    expect(retryNow).toHaveBeenCalledTimes(1);
  });

  it("pluralizes the count when more than one row is pending", () => {
    mockUseOnlineStatus.mockReturnValue({
      isOnline: true,
      pendingCount: 3,
      retryNow: vi.fn(),
    });

    renderWithTheme();
    expect(screen.getByRole("status").textContent).toMatch(
      /3 changes waiting to sync/i,
    );
  });
});
