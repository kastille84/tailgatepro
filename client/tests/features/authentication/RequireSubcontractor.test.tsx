import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { RequireSubcontractor } from "../../../src/features/authentication/RequireSubcontractor";
import theme from "../../../src/styles/theme";

const mockUseCurrentUser = vi.fn();
vi.mock("../../../src/hooks/useCurrentUser", () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));

const renderWithGuard = () =>
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={["/talks"]}>
        <Routes>
          <Route
            path="/dashboard"
            element={<div data-testid="dashboard-page" />}
          />
          <Route element={<RequireSubcontractor />}>
            <Route path="/talks" element={<div data-testid="talks-page" />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );

describe("RequireSubcontractor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a status message and neither route while loading", () => {
    mockUseCurrentUser.mockReturnValue({ isGc: false, isLoading: true });

    renderWithGuard();

    expect(screen.getByRole("status")).toBeDefined();
    expect(screen.queryByTestId("talks-page")).toBeNull();
    expect(screen.queryByTestId("dashboard-page")).toBeNull();
  });

  it("redirects to /dashboard for a GC company", () => {
    mockUseCurrentUser.mockReturnValue({ isGc: true, isLoading: false });

    renderWithGuard();

    expect(screen.getByTestId("dashboard-page")).toBeDefined();
    expect(screen.queryByTestId("talks-page")).toBeNull();
  });

  it("renders the protected route's Outlet for a non-GC company", () => {
    mockUseCurrentUser.mockReturnValue({ isGc: false, isLoading: false });

    renderWithGuard();

    expect(screen.getByTestId("talks-page")).toBeDefined();
    expect(screen.queryByTestId("dashboard-page")).toBeNull();
  });
});
