import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { RequireGc } from "../../../src/features/authentication/RequireGc";
import theme from "../../../src/styles/theme";

const mockUseCurrentUser = vi.fn();
vi.mock("../../../src/hooks/useCurrentUser", () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));

const renderWithGuard = () =>
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={["/gc"]}>
        <Routes>
          <Route
            path="/dashboard"
            element={<div data-testid="dashboard-page" />}
          />
          <Route element={<RequireGc />}>
            <Route path="/gc" element={<div data-testid="gc-page" />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );

describe("RequireGc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a status message and neither route while loading", () => {
    mockUseCurrentUser.mockReturnValue({ isGc: false, isLoading: true });

    renderWithGuard();

    expect(screen.getByRole("status")).toBeDefined();
    expect(screen.queryByTestId("gc-page")).toBeNull();
    expect(screen.queryByTestId("dashboard-page")).toBeNull();
  });

  it("redirects to /dashboard when the company isn't a GC", () => {
    mockUseCurrentUser.mockReturnValue({ isGc: false, isLoading: false });

    renderWithGuard();

    expect(screen.getByTestId("dashboard-page")).toBeDefined();
    expect(screen.queryByTestId("gc-page")).toBeNull();
  });

  it("renders the protected route's Outlet for a GC company", () => {
    mockUseCurrentUser.mockReturnValue({ isGc: true, isLoading: false });

    renderWithGuard();

    expect(screen.getByTestId("gc-page")).toBeDefined();
    expect(screen.queryByTestId("dashboard-page")).toBeNull();
  });
});
