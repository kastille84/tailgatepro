import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { ResetPassword } from "../../../src/pages/ResetPassword/ResetPassword";
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

const renderResetPassword = () =>
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={["/reset-password"]}>
        <Routes>
          <Route path="/reset-password" element={<ResetPassword />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );

describe("ResetPassword page", () => {
  let updatePassword: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    updatePassword = vi.fn().mockResolvedValue(undefined);
  });

  it("shows a loading status while the recovery session resolves", () => {
    mockUseAuth.mockReturnValue({
      session: null,
      loading: true,
      updatePassword,
    });

    renderResetPassword();

    expect(screen.getByText(/checking your reset link/i)).toBeDefined();
  });

  it("shows an invalid-link message when there is no session once loading finishes", () => {
    mockUseAuth.mockReturnValue({
      session: null,
      loading: false,
      updatePassword,
    });

    renderResetPassword();

    expect(screen.getByText(/invalid or has expired/i)).toBeDefined();
    expect(
      screen.getByRole("link", { name: /request a new link/i }),
    ).toBeDefined();
  });

  it("shows the password field's own validation error when it's too short", async () => {
    mockUseAuth.mockReturnValue({
      session: { access_token: "recovery-token" },
      loading: false,
      updatePassword,
    });

    renderResetPassword();

    fireEvent.change(screen.getByLabelText(/^new password$/i), {
      target: { value: "short" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /update password/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/password must be at least 8 characters/i),
      ).toBeDefined();
    });
    expect(updatePassword).not.toHaveBeenCalled();
  });

  it("shows a validation error when the passwords don't match", async () => {
    mockUseAuth.mockReturnValue({
      session: { access_token: "recovery-token" },
      loading: false,
      updatePassword,
    });

    renderResetPassword();

    fireEvent.change(screen.getByLabelText(/^new password$/i), {
      target: { value: "supersecret" },
    });
    fireEvent.change(screen.getByLabelText(/^confirm new password$/i), {
      target: { value: "different" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /update password/i }),
    );

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeDefined();
    });
    expect(updatePassword).not.toHaveBeenCalled();
  });

  it("updates the password and navigates to /dashboard on success", async () => {
    mockUseAuth.mockReturnValue({
      session: { access_token: "recovery-token" },
      loading: false,
      updatePassword,
    });

    renderResetPassword();

    fireEvent.change(screen.getByLabelText(/^new password$/i), {
      target: { value: "supersecret" },
    });
    fireEvent.change(screen.getByLabelText(/^confirm new password$/i), {
      target: { value: "supersecret" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /update password/i }),
    );

    await waitFor(() => {
      expect(updatePassword).toHaveBeenCalledWith("supersecret");
      expect(toast.success).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("shows an error toast when updatePassword fails", async () => {
    updatePassword.mockRejectedValue(new Error("Link expired"));
    mockUseAuth.mockReturnValue({
      session: { access_token: "recovery-token" },
      loading: false,
      updatePassword,
    });

    renderResetPassword();

    fireEvent.change(screen.getByLabelText(/^new password$/i), {
      target: { value: "supersecret" },
    });
    fireEvent.change(screen.getByLabelText(/^confirm new password$/i), {
      target: { value: "supersecret" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /update password/i }),
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Link expired");
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("falls back to a generic error toast when updatePassword rejects with a non-Error value", async () => {
    updatePassword.mockRejectedValue("network down");
    mockUseAuth.mockReturnValue({
      session: { access_token: "recovery-token" },
      loading: false,
      updatePassword,
    });

    renderResetPassword();

    fireEvent.change(screen.getByLabelText(/^new password$/i), {
      target: { value: "supersecret" },
    });
    fireEvent.change(screen.getByLabelText(/^confirm new password$/i), {
      target: { value: "supersecret" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /update password/i }),
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Could not update password.");
    });
  });
});
