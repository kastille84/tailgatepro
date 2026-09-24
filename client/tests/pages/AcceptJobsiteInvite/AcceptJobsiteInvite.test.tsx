import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { AcceptJobsiteInvite } from "../../../src/pages/AcceptJobsiteInvite/AcceptJobsiteInvite";
import theme from "../../../src/styles/theme";

const TOKEN = "a".repeat(64);

const mockUseAuth = vi.fn();
vi.mock("../../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockCreateProfile = vi.fn();
vi.mock("../../../src/hooks/useCreateProfile", () => ({
  useCreateProfile: () => ({
    createProfile: mockCreateProfile,
    isCreating: false,
  }),
}));

const mockUseCurrentUser = vi.fn();
vi.mock("../../../src/hooks/useCurrentUser", () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));

const mockUsePreview = vi.fn();
vi.mock("../../../src/hooks/useJobsiteInvitePreview", () => ({
  useJobsiteInvitePreview: (token: string | undefined) => mockUsePreview(token),
}));

const mockAcceptInvite = vi.fn();
vi.mock("../../../src/hooks/useAcceptJobsiteInvite", () => ({
  useAcceptJobsiteInvite: () => ({
    acceptInvite: mockAcceptInvite,
    isAccepting: false,
  }),
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
  gcCompanyName: "Turner Construction",
  jobsiteName: "Riverside Tower",
  email: "jane@acme.com",
};

const renderPage = () =>
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[`/jobsite-invite/${TOKEN}`]}>
        <Routes>
          <Route path="/jobsite-invite/:token" element={<AcceptJobsiteInvite />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );

const openSignup = () =>
  fireEvent.click(
    screen.getByRole("button", { name: /create a company account/i }),
  );

const fillSignup = () => {
  openSignup();
  fireEvent.change(screen.getByLabelText(/your company name/i), {
    target: { value: "Acme Roofing" },
  });
  fireEvent.change(screen.getByLabelText(/your name/i), {
    target: { value: "Jane Doe" },
  });
  fireEvent.change(screen.getByLabelText(/^password$/i), {
    target: { value: "supersecret" },
  });
  fireEvent.click(screen.getByRole("button", { name: /create account/i }));
};

describe("AcceptJobsiteInvite page", () => {
  let signUpWithEmail: ReturnType<typeof vi.fn>;
  let logout: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    signUpWithEmail = vi.fn();
    logout = vi.fn();
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      signUpWithEmail,
      logout,
    });
    mockUseCurrentUser.mockReturnValue({
      isGc: false,
      role: "admin",
      isLoading: false,
    });
    mockUsePreview.mockReturnValue({
      preview,
      isLoading: false,
      isError: false,
    });
    mockAcceptInvite.mockResolvedValue(undefined);
  });

  it("passes the URL token to the preview hook", () => {
    renderPage();
    expect(mockUsePreview).toHaveBeenCalledWith(TOKEN);
  });

  it("shows a loading state while the preview loads", () => {
    mockUsePreview.mockReturnValue({ preview: null, isLoading: true, isError: false });
    renderPage();
    expect(screen.getByText(/loading your invite/i)).toBeDefined();
  });

  it("shows a loading state while auth resolves", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true, signUpWithEmail, logout });
    renderPage();
    expect(screen.getByText(/loading your invite/i)).toBeDefined();
  });

  it("shows an invalid-link state when the token is invalid or expired", () => {
    mockUsePreview.mockReturnValue({ preview: null, isLoading: false, isError: true });
    renderPage();

    expect(
      screen.getByText(/this invite link is invalid or has expired/i),
    ).toBeDefined();
    expect(screen.queryByLabelText(/your company name/i)).toBeNull();
  });

  describe("signed out", () => {
    it("leads with sign-in and hides the signup form until asked", () => {
      renderPage();

      expect(
        screen.getByRole("button", { name: /sign in to accept/i }),
      ).toBeDefined();
      expect(screen.queryByLabelText(/your company name/i)).toBeNull();
      expect(screen.queryByLabelText(/^password$/i)).toBeNull();
    });

    it("sends an existing account to login with the invited email and a way back", () => {
      renderPage();

      fireEvent.click(screen.getByRole("button", { name: /sign in to accept/i }));

      expect(mockNavigate).toHaveBeenCalledWith("/login", {
        state: { from: `/jobsite-invite/${TOKEN}`, email: "jane@acme.com" },
      });
    });

    it("reveals the GC and jobsite, a read-only email, and the signup fields on request", () => {
      renderPage();
      openSignup();

      expect(screen.getAllByText(/turner construction/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/riverside tower/i).length).toBeGreaterThan(0);
      const email = screen.getByLabelText(/^email$/i) as HTMLInputElement;
      expect(email.value).toBe("jane@acme.com");
      expect(email.readOnly).toBe(true);
      expect(screen.getByLabelText(/your company name/i)).toBeDefined();
      expect(screen.getByLabelText(/your name/i)).toBeDefined();
      expect(screen.getByLabelText(/^password$/i)).toBeDefined();
    });

    it("falls back to generic wording when names are missing", () => {
      mockUsePreview.mockReturnValue({
        preview: { ...preview, gcCompanyName: null, jobsiteName: null },
        isLoading: false,
        isError: false,
      });
      renderPage();

      expect(screen.getByText(/a general contractor/i)).toBeDefined();
      expect(screen.getAllByText(/a job site/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/join this job site on tailgatepro/i)).toBeDefined();
    });

    it("validates the form before signing up", async () => {
      renderPage();
      openSignup();

      fireEvent.click(screen.getByRole("button", { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText(/company name is required/i)).toBeDefined();
        expect(screen.getByText(/^name is required$/i)).toBeDefined();
        expect(screen.getByText(/at least 8 characters/i)).toBeDefined();
      });
      expect(signUpWithEmail).not.toHaveBeenCalled();
    });

    it("signs up with the jobsite token and company name, creates the profile, and goes to /projects", async () => {
      signUpWithEmail.mockResolvedValue({ session: { access_token: "t" } });
      mockCreateProfile.mockResolvedValue({ id: "u1" });
      renderPage();

      fillSignup();

      await waitFor(() => {
        expect(signUpWithEmail).toHaveBeenCalledWith("jane@acme.com", "supersecret", {
          name: "Jane Doe",
          companyName: "Acme Roofing",
          jobsiteInviteToken: TOKEN,
        });
        expect(mockCreateProfile).toHaveBeenCalledWith({ accessToken: "t" });
        expect(mockNavigate).toHaveBeenCalledWith("/projects");
      });
    });

    it("shows check-your-email and skips profile creation when no session comes back", async () => {
      signUpWithEmail.mockResolvedValue({ session: null });
      renderPage();

      fillSignup();

      await waitFor(() => expect(screen.getByText(/check your email/i)).toBeDefined());
      expect(screen.getByText("jane@acme.com")).toBeDefined();
      expect(mockCreateProfile).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("toasts the error and does not navigate when signup fails", async () => {
      signUpWithEmail.mockRejectedValue(new Error("Email already registered"));
      renderPage();

      fillSignup();

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("Email already registered"),
      );
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("falls back to a generic toast for a non-Error rejection", async () => {
      signUpWithEmail.mockRejectedValue("network down");
      renderPage();

      fillSignup();

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("Could not accept this invite."),
      );
    });
  });

  describe("signed in", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { email: "JANE@acme.com" },
        loading: false,
        signUpWithEmail,
        logout,
      });
    });

    it("lets a subcontractor admin accept, then goes to /projects (email match is case-insensitive)", async () => {
      renderPage();

      expect(screen.queryByLabelText(/your company name/i)).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: /accept invite/i }));

      await waitFor(() => expect(mockAcceptInvite).toHaveBeenCalledWith(TOKEN));
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/projects"));
    });

    it("lets a safety manager accept too", () => {
      mockUseCurrentUser.mockReturnValue({ isGc: false, role: "safety_manager", isLoading: false });
      renderPage();
      expect(screen.getByRole("button", { name: /accept invite/i })).toBeDefined();
    });

    it("stays put when accepting fails (the hook already toasts)", async () => {
      mockAcceptInvite.mockRejectedValue(new Error("nope"));
      renderPage();

      fireEvent.click(screen.getByRole("button", { name: /accept invite/i }));

      await waitFor(() => expect(mockAcceptInvite).toHaveBeenCalled());
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("waits for the profile before offering accept", () => {
      mockUseCurrentUser.mockReturnValue({ isGc: false, role: null, isLoading: true });
      renderPage();

      expect(screen.getByText(/checking your account/i)).toBeDefined();
      expect(screen.queryByRole("button", { name: /accept invite/i })).toBeNull();
    });

    it("explains an email mismatch and offers Log out", () => {
      mockUseAuth.mockReturnValue({
        user: { email: "someone@else.com" },
        loading: false,
        signUpWithEmail,
        logout,
      });
      renderPage();

      expect(screen.getByRole("alert").textContent).toMatch(
        /sent to jane@acme.com.*signed in as someone@else.com/i,
      );
      expect(screen.queryByRole("button", { name: /accept invite/i })).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: /log out/i }));
      expect(logout).toHaveBeenCalled();
    });

    it("treats a user with no email as a mismatch", () => {
      mockUseAuth.mockReturnValue({
        user: { email: undefined },
        loading: false,
        signUpWithEmail,
        logout,
      });
      renderPage();

      expect(screen.getByRole("alert").textContent).toMatch(/sent to jane@acme.com/i);
    });

    it("blocks a GC account", () => {
      mockUseCurrentUser.mockReturnValue({ isGc: true, role: "admin", isLoading: false });
      renderPage();

      expect(screen.getByRole("alert").textContent).toMatch(
        /general contractor accounts can't join/i,
      );
      expect(screen.queryByRole("button", { name: /accept invite/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /log out/i })).toBeNull();
    });

    it("blocks a foreman and points them to an admin", () => {
      mockUseCurrentUser.mockReturnValue({ isGc: false, role: "foreman", isLoading: false });
      renderPage();

      expect(screen.getByRole("alert").textContent).toMatch(
        /only an admin or safety manager/i,
      );
      expect(screen.queryByRole("button", { name: /accept invite/i })).toBeNull();
    });

    it("falls back to generic wording when names are missing", () => {
      mockUsePreview.mockReturnValue({
        preview: { ...preview, jobsiteName: null },
        isLoading: false,
        isError: false,
      });
      renderPage();

      expect(screen.getByText(/join this job site/i)).toBeDefined();
    });
  });
});
