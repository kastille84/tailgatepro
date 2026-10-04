import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { AcceptInvite } from "../../../src/pages/AcceptInvite/AcceptInvite";
import theme from "../../../src/styles/theme";

const TOKEN = "a".repeat(64);

const mockUseAuth = vi.fn();
vi.mock("../../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockCreateProfile = vi.fn();
const mockUseCreateProfile = vi.fn();
vi.mock("../../../src/hooks/useCreateProfile", () => ({
  useCreateProfile: () => mockUseCreateProfile(),
}));

const mockUseInvitePreview = vi.fn();
vi.mock("../../../src/hooks/useInvitePreview", () => ({
  useInvitePreview: (token: string | undefined) => mockUseInvitePreview(token),
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

const preview = {
  companyName: "Rivera Electric",
  email: "newhire@example.com",
  role: "foreman" as const,
};

const renderPage = () =>
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[`/invite/${TOKEN}`]}>
        <Routes>
          <Route path="/invite/:token" element={<AcceptInvite />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );

describe("AcceptInvite page", () => {
  let signUpWithEmail: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    signUpWithEmail = vi.fn();
    mockUseAuth.mockReturnValue({ signUpWithEmail });
    mockUseCreateProfile.mockReturnValue({
      createProfile: mockCreateProfile,
      isCreating: false,
    });
    mockUseInvitePreview.mockReturnValue({
      preview,
      isLoading: false,
      isError: false,
    });
  });

  it("shows a loading state while the preview is loading", () => {
    mockUseInvitePreview.mockReturnValue({
      preview: null,
      isLoading: true,
      isError: false,
    });

    renderPage();

    expect(screen.getByText(/loading your invite/i)).toBeDefined();
  });

  it("shows an invalid-link state and no form when the token is invalid or expired", () => {
    mockUseInvitePreview.mockReturnValue({
      preview: null,
      isLoading: false,
      isError: true,
    });

    renderPage();

    expect(
      screen.getByText(/this invite link is invalid or has expired/i),
    ).toBeDefined();
    expect(screen.queryByLabelText(/^name$/i)).toBeNull();
  });

  it("renders the read-only email and company/role banner, and the name/password fields", () => {
    renderPage();

    expect(screen.getAllByText(/rivera electric/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Foreman")).toBeDefined();
    const emailField = screen.getByLabelText(/^email$/i) as HTMLInputElement;
    expect(emailField.value).toBe("newhire@example.com");
    expect(emailField.readOnly).toBe(true);
    expect(screen.getByLabelText(/^name$/i)).toBeDefined();
    expect(screen.getByLabelText(/^password$/i)).toBeDefined();
  });

  it("shows validation errors when submitting the form empty", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/^name is required$/i)).toBeDefined();
      expect(
        screen.getByText(/^password must be at least 8 characters$/i),
      ).toBeDefined();
    });
    expect(signUpWithEmail).not.toHaveBeenCalled();
  });

  it("signs up with the invite token, creates the profile, and navigates to /dashboard when a session comes back immediately", async () => {
    signUpWithEmail.mockResolvedValue({ session: { access_token: "token-123" } });
    mockCreateProfile.mockResolvedValue({ id: "user-1" });

    renderPage();
    fireEvent.change(screen.getByLabelText(/^name$/i), {
      target: { value: "Jamie Foreman" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "supersecret" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(signUpWithEmail).toHaveBeenCalledWith(
        "newhire@example.com",
        "supersecret",
        { name: "Jamie Foreman", inviteToken: TOKEN },
      );
      expect(mockCreateProfile).toHaveBeenCalledWith({ accessToken: "token-123" });
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("shows a check-your-email state and skips profile creation when no session is returned", async () => {
    signUpWithEmail.mockResolvedValue({ session: null });

    renderPage();
    fireEvent.change(screen.getByLabelText(/^name$/i), {
      target: { value: "Jamie Foreman" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "supersecret" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeDefined();
    });
    expect(screen.getByText("newhire@example.com")).toBeDefined();
    expect(mockCreateProfile).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("falls back to a generic error toast when signup rejects with a non-Error value", async () => {
    signUpWithEmail.mockRejectedValue("network down");

    renderPage();
    fireEvent.change(screen.getByLabelText(/^name$/i), {
      target: { value: "Jamie Foreman" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "supersecret" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Could not accept this invite.");
    });
  });

  it('falls back to "your team" when the invite has no company name', () => {
    mockUseInvitePreview.mockReturnValue({
      preview: { ...preview, companyName: null },
      isLoading: false,
      isError: false,
    });

    renderPage();

    expect(screen.getByText(/join your team on tailgatepro/i)).toBeDefined();
  });

  it("shows an error toast and does not navigate when signUpWithEmail fails", async () => {
    signUpWithEmail.mockRejectedValue(new Error("Email already registered"));

    renderPage();
    fireEvent.change(screen.getByLabelText(/^name$/i), {
      target: { value: "Jamie Foreman" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "supersecret" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Email already registered");
    });
    expect(mockCreateProfile).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
