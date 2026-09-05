import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { Signup } from "../../../src/pages/Signup/Signup";
import theme from "../../../src/styles/theme";

const mockUseAuth = vi.fn();
vi.mock("../../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockCreateProfile = vi.fn();
const mockUseCreateProfile = vi.fn();
vi.mock("../../../src/hooks/useCreateProfile", () => ({
  useCreateProfile: () => mockUseCreateProfile(),
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

const renderSignup = () =>
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={["/signup"]}>
        <Routes>
          <Route path="/signup" element={<Signup />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );

const fillRequiredFields = () => {
  fireEvent.change(screen.getByLabelText(/^name$/i), {
    target: { value: "Alex Builder" },
  });
  fireEvent.change(screen.getByLabelText(/^company name$/i), {
    target: { value: "Rivera Electric" },
  });
  fireEvent.change(screen.getByLabelText(/^work email$/i), {
    target: { value: "alex@example.com" },
  });
  fireEvent.change(screen.getByLabelText(/^password$/i), {
    target: { value: "supersecret" },
  });
};

describe("Signup page", () => {
  let signUpWithEmail: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    signUpWithEmail = vi.fn();
    mockUseAuth.mockReturnValue({ signUpWithEmail });
    mockUseCreateProfile.mockReturnValue({
      createProfile: mockCreateProfile,
      isCreating: false,
    });
  });

  it("defaults the company-type toggle to Subcontractor", () => {
    renderSignup();

    expect(
      screen
        .getByRole("button", { name: "Subcontractor" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen
        .getByRole("button", { name: "General Contractor" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("lets the user switch the company type", () => {
    renderSignup();

    fireEvent.click(
      screen.getByRole("button", { name: "General Contractor" }),
    );

    expect(
      screen
        .getByRole("button", { name: "General Contractor" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("shows validation errors when submitting the form empty", async () => {
    renderSignup();

    fireEvent.click(
      screen.getByRole("button", { name: /create account/i }),
    );

    await waitFor(() => {
      expect(screen.getByText(/^name is required$/i)).toBeDefined();
      expect(screen.getByText(/^company name is required$/i)).toBeDefined();
      expect(screen.getByText(/^email is required$/i)).toBeDefined();
      expect(
        screen.getByText(/^password must be at least 8 characters$/i),
      ).toBeDefined();
    });
    expect(signUpWithEmail).not.toHaveBeenCalled();
  });

  it("creates the profile and navigates to /dashboard when signup returns a session", async () => {
    signUpWithEmail.mockResolvedValue({
      session: { access_token: "token-123" },
    });
    mockCreateProfile.mockResolvedValue({ id: "user-1" });

    renderSignup();
    fillRequiredFields();
    fireEvent.click(
      screen.getByRole("button", { name: /create account/i }),
    );

    await waitFor(() => {
      expect(signUpWithEmail).toHaveBeenCalledWith(
        "alex@example.com",
        "supersecret",
      );
      expect(mockCreateProfile).toHaveBeenCalledWith({
        name: "Alex Builder",
        companyName: "Rivera Electric",
        companyType: "subcontractor",
        accessToken: "token-123",
      });
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("shows a check-your-email panel and skips profile creation when no session is returned", async () => {
    signUpWithEmail.mockResolvedValue({ session: null });

    renderSignup();
    fillRequiredFields();
    fireEvent.click(
      screen.getByRole("button", { name: /create account/i }),
    );

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeDefined();
    });
    expect(mockCreateProfile).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("shows an error toast when signUpWithEmail fails", async () => {
    signUpWithEmail.mockRejectedValue(new Error("Email already registered"));

    renderSignup();
    fillRequiredFields();
    fireEvent.click(
      screen.getByRole("button", { name: /create account/i }),
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Email already registered");
    });
    expect(mockCreateProfile).not.toHaveBeenCalled();
  });

  it("falls back to a generic error toast when signup rejects with a non-Error value", async () => {
    signUpWithEmail.mockRejectedValue("network down");

    renderSignup();
    fillRequiredFields();
    fireEvent.click(
      screen.getByRole("button", { name: /create account/i }),
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Could not sign up.");
    });
  });
});
