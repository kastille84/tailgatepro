import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { ForgotPassword } from "../../../src/pages/ForgotPassword/ForgotPassword";
import theme from "../../../src/styles/theme";

const mockUseAuth = vi.fn();
vi.mock("../../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("react-hot-toast", () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

import toast from "react-hot-toast";

const renderForgotPassword = () =>
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={["/forgot-password"]}>
        <Routes>
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/login" element={<div data-testid="login-page" />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );

describe("ForgotPassword page", () => {
  let sendPasswordReset: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    sendPasswordReset = vi.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({ sendPasswordReset });
  });

  it("shows a validation error when submitting an empty email", async () => {
    renderForgotPassword();

    fireEvent.click(
      screen.getByRole("button", { name: /send reset link/i }),
    );

    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeDefined();
    });
    expect(sendPasswordReset).not.toHaveBeenCalled();
  });

  it("calls sendPasswordReset and shows the same success panel regardless of whether the email exists", async () => {
    renderForgotPassword();

    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "alex@example.com" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /send reset link/i }),
    );

    await waitFor(() => {
      expect(sendPasswordReset).toHaveBeenCalledWith("alex@example.com");
      expect(
        screen.getByText(/if an account exists for that email/i),
      ).toBeDefined();
    });
  });

  it("shows an error toast when sendPasswordReset fails", async () => {
    sendPasswordReset.mockRejectedValue(new Error("Rate limited"));
    renderForgotPassword();

    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "alex@example.com" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /send reset link/i }),
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Rate limited");
    });
    expect(
      screen.queryByText(/if an account exists for that email/i),
    ).toBeNull();
  });

  it("falls back to a generic error toast when sendPasswordReset rejects with a non-Error value", async () => {
    sendPasswordReset.mockRejectedValue("network down");
    renderForgotPassword();

    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "alex@example.com" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /send reset link/i }),
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Something went wrong.");
    });
  });
});
