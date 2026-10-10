import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { JoinCrew } from "../../../src/pages/JoinCrew/JoinCrew";
import theme from "../../../src/styles/theme";

const TOKEN = "f".repeat(64);

const mockUseAuth = vi.fn();
vi.mock("../../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockCreateProfile = vi.fn();
const mockUseCreateProfile = vi.fn();
vi.mock("../../../src/hooks/useCreateProfile", () => ({
  useCreateProfile: () => mockUseCreateProfile(),
}));

const mockUseCrewJoinPreview = vi.fn();
vi.mock("../../../src/hooks/useCrewJoinPreview", () => ({
  useCrewJoinPreview: (token: string | undefined) => mockUseCrewJoinPreview(token),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("react-hot-toast", () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

import toast from "react-hot-toast";

const preview = { crewName: "Hyperion - Framing", gcName: "Hyperion" };

const renderPage = () =>
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[`/crew-join/${TOKEN}`]}>
        <Routes>
          <Route path="/crew-join/:token" element={<JoinCrew />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );

const fillAndSubmit = (email = "jamie@example.com") => {
  fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: "Jamie Foreman" } });
  fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "supersecret" } });
  fireEvent.click(screen.getByRole("button", { name: /create account/i }));
};

describe("JoinCrew page", () => {
  let signUpWithEmail: ReturnType<typeof vi.fn>;
  let logout: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    signUpWithEmail = vi.fn();
    logout = vi.fn();
    mockUseAuth.mockReturnValue({ session: null, signUpWithEmail, logout });
    mockUseCreateProfile.mockReturnValue({ createProfile: mockCreateProfile, isCreating: false });
    mockUseCrewJoinPreview.mockReturnValue({ preview, isLoading: false, isError: false });
  });

  it("asks the preview hook about the token in the URL", () => {
    renderPage();

    expect(mockUseCrewJoinPreview).toHaveBeenCalledWith(TOKEN);
  });

  it("shows a loading state while the preview loads", () => {
    mockUseCrewJoinPreview.mockReturnValue({ preview: null, isLoading: true, isError: false });

    renderPage();

    expect(screen.getByText(/loading your join link/i)).toBeDefined();
  });

  it("shows an invalid-link state and no form for a bad or expired link", () => {
    mockUseCrewJoinPreview.mockReturnValue({ preview: null, isLoading: false, isError: true });

    renderPage();

    expect(screen.getByText(/this join link is invalid or has expired/i)).toBeDefined();
    expect(screen.queryByLabelText(/^name$/i)).toBeNull();
  });

  it("names the crew and GC, says foreman, and asks for email, name and password", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: /join hyperion - framing on tailgatepro/i })).toBeDefined();
    expect(screen.getByText("Hyperion")).toBeDefined();
    expect(screen.getByText("Foreman")).toBeDefined();
    expect((screen.getByLabelText(/^email$/i) as HTMLInputElement).readOnly).toBe(false);
    expect(screen.getByLabelText(/^name$/i)).toBeDefined();
    expect(screen.getByLabelText(/^password$/i)).toBeDefined();
  });

  it("leaves the GC out of the banner when the preview has no GC name", () => {
    mockUseCrewJoinPreview.mockReturnValue({
      preview: { crewName: "Hyperion - Framing", gcName: null },
      isLoading: false,
      isError: false,
    });

    renderPage();

    expect(screen.queryByText("Hyperion")).toBeNull();
    expect(screen.getByText("Foreman")).toBeDefined();
  });

  it("shows validation errors when submitting empty, and for a bad email", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() => {
      expect(screen.getByText(/^email is required$/i)).toBeDefined();
      expect(screen.getByText(/^name is required$/i)).toBeDefined();
      expect(screen.getByText(/^password must be at least 8 characters$/i)).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: "not-an-email" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() => {
      expect(screen.getByText(/enter a valid email address/i)).toBeDefined();
    });
    expect(signUpWithEmail).not.toHaveBeenCalled();
  });

  it("signs up with the join token, creates the profile and goes to /dashboard", async () => {
    signUpWithEmail.mockResolvedValue({ session: { access_token: "token-123" } });
    mockCreateProfile.mockResolvedValue({ id: "user-1" });

    renderPage();
    fillAndSubmit();

    await waitFor(() => {
      expect(signUpWithEmail).toHaveBeenCalledWith("jamie@example.com", "supersecret", {
        name: "Jamie Foreman",
        crewJoinToken: TOKEN,
      });
      expect(mockCreateProfile).toHaveBeenCalledWith({ accessToken: "token-123" });
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("shows a check-your-email state with the entered email when no session comes back", async () => {
    signUpWithEmail.mockResolvedValue({ session: null });

    renderPage();
    fillAndSubmit("jamie@example.com");

    await waitFor(() => expect(screen.getByText(/check your email/i)).toBeDefined());
    expect(screen.getByText("jamie@example.com")).toBeDefined();
    expect(screen.getByText(/finish setting you up in hyperion - framing/i)).toBeDefined();
    expect(mockCreateProfile).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("toasts the error and does not navigate when signup fails", async () => {
    signUpWithEmail.mockRejectedValue(new Error("Email already registered"));

    renderPage();
    fillAndSubmit();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Email already registered"));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("falls back to a generic error toast for a non-Error rejection", async () => {
    signUpWithEmail.mockRejectedValue("network down");

    renderPage();
    fillAndSubmit();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Could not join this crew."));
  });

  it("asks a signed-in visitor to sign out first, with no form", () => {
    mockUseAuth.mockReturnValue({
      session: { access_token: "token-123" },
      signUpWithEmail,
      logout,
    });

    renderPage();

    expect(screen.getByText(/you're already signed in/i)).toBeDefined();
    expect(screen.queryByLabelText(/^name$/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    expect(logout).toHaveBeenCalled();
  });
});
