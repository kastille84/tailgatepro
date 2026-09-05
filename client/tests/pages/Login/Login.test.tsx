import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { Login } from "../../../src/pages/Login/Login";
import theme from "../../../src/styles/theme";

const mockUseAuth = vi.fn();
vi.mock("../../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("react-hot-toast", () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

import toast from "react-hot-toast";

const renderLogin = () =>
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<div data-testid="dashboard-page" />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );

describe("Login page", () => {
  let loginWithGoogle: ReturnType<typeof vi.fn>;
  let loginWithEmail: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    loginWithGoogle = vi.fn().mockResolvedValue(undefined);
    loginWithEmail = vi.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      loginWithGoogle,
      loginWithEmail,
    });
  });

  it("shows a loading status while auth is resolving", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: true,
      loginWithGoogle,
      loginWithEmail,
    });

    renderLogin();

    expect(screen.getByText(/checking your session/i)).toBeDefined();
  });

  it("redirects to /dashboard when already authenticated", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1" },
      loading: false,
      loginWithGoogle,
      loginWithEmail,
    });

    renderLogin();

    expect(screen.getByTestId("dashboard-page")).toBeDefined();
  });

  it("calls loginWithGoogle when the Google button is clicked", async () => {
    renderLogin();

    fireEvent.click(
      screen.getByRole("button", { name: /continue with google/i }),
    );

    await waitFor(() => {
      expect(loginWithGoogle).toHaveBeenCalledTimes(1);
    });
  });

  it("shows an error toast when Google sign-in fails to start", async () => {
    loginWithGoogle.mockRejectedValue(new Error("popup blocked"));
    renderLogin();

    fireEvent.click(
      screen.getByRole("button", { name: /continue with google/i }),
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "We couldn't start Google sign-in. Please try again.",
      );
    });
  });

  it("shows validation errors when submitting the email form empty", async () => {
    renderLogin();

    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeDefined();
      expect(screen.getByText(/password is required/i)).toBeDefined();
    });
    expect(loginWithEmail).not.toHaveBeenCalled();
  });

  it("logs in and navigates to /dashboard on successful email/password submit", async () => {
    renderLogin();

    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "alex@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "supersecret" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(loginWithEmail).toHaveBeenCalledWith(
        "alex@example.com",
        "supersecret",
      );
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("shows an error toast when login fails", async () => {
    loginWithEmail.mockRejectedValue(new Error("Invalid credentials"));
    renderLogin();

    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "alex@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "wrongpassword" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Invalid credentials");
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("falls back to a generic error toast when login rejects with a non-Error value", async () => {
    loginWithEmail.mockRejectedValue("network down");
    renderLogin();

    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "alex@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "supersecret" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Could not log in.");
    });
  });
});
