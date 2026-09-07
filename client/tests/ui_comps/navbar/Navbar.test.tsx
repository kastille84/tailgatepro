import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

import Navbar from "../../../src/ui_comps/navbar/Navbar";
import theme from "../../../src/styles/theme";

const mockUseAuth = vi.fn();
vi.mock("../../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const renderNavbar = () =>
  render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <Navbar />
      </ThemeProvider>
    </MemoryRouter>,
  );

describe("Navbar", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      logout: vi.fn(),
    });
  });

  it("renders the brand and toggles the mobile menu state", () => {
    renderNavbar();

    expect(
      screen.getByRole("navigation", { name: /main navigation/i }),
    ).toBeDefined();
    expect(screen.getByAltText(/tailgatepro/i)).toBeDefined();

    const toggle = screen.getByLabelText(/toggle menu/i);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  });

  it("shows no auth controls while loading", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true, logout: vi.fn() });

    renderNavbar();

    expect(screen.queryByRole("button", { name: /^login$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^sign up$/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /dashboard/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /logout/i })).toBeNull();
  });

  it("shows Login and Sign Up links when logged out", () => {
    renderNavbar();

    const loginLink = screen
      .getByRole("button", { name: /^login$/i })
      .closest("a");
    expect(loginLink?.getAttribute("href")).toBe("/login");

    const signUpLink = screen
      .getByRole("button", { name: /^sign up$/i })
      .closest("a");
    expect(signUpLink?.getAttribute("href")).toBe("/signup");
  });

  it("shows a Dashboard link and Logout button when logged in, and Logout calls logout()", async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      user: { id: "user-1" },
      loading: false,
      logout,
    });

    renderNavbar();

    expect(
      screen.getByRole("link", { name: /dashboard/i }).getAttribute("href"),
    ).toBe("/dashboard");
    expect(screen.queryByRole("button", { name: /^login$/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /logout/i }));

    await waitFor(() => {
      expect(logout).toHaveBeenCalledTimes(1);
    });
  });
});
