import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { RequireAuth } from "../../../src/features/authentication/RequireAuth";
import theme from "../../../src/styles/theme";

const mockUseAuth = vi.fn();
vi.mock("../../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const renderWithGuard = () =>
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="/login" element={<div data-testid="login-page" />} />
          <Route element={<RequireAuth />}>
            <Route
              path="/dashboard"
              element={<div data-testid="dashboard-page" />}
            />
          </Route>
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );

describe("RequireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a status message and neither route while loading", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });

    renderWithGuard();

    expect(screen.getByRole("status")).toBeDefined();
    expect(screen.queryByTestId("dashboard-page")).toBeNull();
    expect(screen.queryByTestId("login-page")).toBeNull();
  });

  it("redirects to /login when there is no user", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });

    renderWithGuard();

    expect(screen.getByTestId("login-page")).toBeDefined();
    expect(screen.queryByTestId("dashboard-page")).toBeNull();
  });

  it("renders the protected route's Outlet when authenticated", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1", email: "alex@example.com" },
      loading: false,
    });

    renderWithGuard();

    expect(screen.getByTestId("dashboard-page")).toBeDefined();
    expect(screen.queryByTestId("login-page")).toBeNull();
  });
});
