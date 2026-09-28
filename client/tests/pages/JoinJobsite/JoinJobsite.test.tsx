import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { JoinJobsite } from "../../../src/pages/JoinJobsite/JoinJobsite";
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
vi.mock("../../../src/hooks/useJoinLinkPreview", () => ({
  useJoinLinkPreview: (token: string | undefined) => mockUsePreview(token),
}));

const mockAcceptJoinLink = vi.fn();
vi.mock("../../../src/hooks/useAcceptJoinLink", () => ({
  useAcceptJoinLink: () => ({
    acceptJoinLink: mockAcceptJoinLink,
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
};

const renderPage = () =>
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[`/jobsite-join/${TOKEN}`]}>
        <Routes>
          <Route path="/jobsite-join/:token" element={<JoinJobsite />} />
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
  fireEvent.change(screen.getByLabelText(/your email/i), {
    target: { value: "jane@acme.com" },
  });
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

describe("JoinJobsite page", () => {
  let signUpWithEmail: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    signUpWithEmail = vi.fn();
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      signUpWithEmail,
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
    mockAcceptJoinLink.mockResolvedValue(undefined);
  });

  it("passes the URL token to the preview hook", () => {
    renderPage();
    expect(mockUsePreview).toHaveBeenCalledWith(TOKEN);
  });

  it("shows a loading state while the preview loads", () => {
    mockUsePreview.mockReturnValue({ preview: null, isLoading: true, isError: false });
    renderPage();
    expect(screen.getByText(/loading this job site's link/i)).toBeDefined();
  });

  it("shows a loading state while auth resolves", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true, signUpWithEmail });
    renderPage();
    expect(screen.getByText(/loading this job site's link/i)).toBeDefined();
  });

  it("shows an invalid-link state when the token is invalid", () => {
    mockUsePreview.mockReturnValue({ preview: null, isLoading: false, isError: true });
    renderPage();

    expect(screen.getByText(/this job site link is invalid/i)).toBeDefined();
    expect(screen.queryByLabelText(/your company name/i)).toBeNull();
  });

  describe("signed out", () => {
    it("leads with sign-in and hides the signup form until asked", () => {
      renderPage();

      expect(
        screen.getByRole("button", { name: /sign in to join/i }),
      ).toBeDefined();
      expect(screen.queryByLabelText(/your company name/i)).toBeNull();
      expect(screen.queryByLabelText(/^password$/i)).toBeNull();
    });

    it("sends an existing account to login with a way back (no email to prefill)", () => {
      renderPage();

      fireEvent.click(screen.getByRole("button", { name: /sign in to join/i }));

      expect(mockNavigate).toHaveBeenCalledWith("/login", {
        state: { from: `/jobsite-join/${TOKEN}` },
      });
    });

    it("reveals the GC and jobsite, and an editable email plus the signup fields on request", () => {
      renderPage();
      openSignup();

      expect(screen.getAllByText(/turner construction/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/riverside tower/i).length).toBeGreaterThan(0);
      expect(screen.getByLabelText(/your email/i)).toBeDefined();
      expect(screen.getByLabelText(/your company name/i)).toBeDefined();
      expect(screen.getByLabelText(/your name/i)).toBeDefined();
      expect(screen.getByLabelText(/^password$/i)).toBeDefined();
    });

    it("falls back to generic wording when names are missing", () => {
      mockUsePreview.mockReturnValue({
        preview: { gcCompanyName: null, jobsiteName: null },
        isLoading: false,
        isError: false,
      });
      renderPage();

      expect(screen.getByText(/a general contractor/i)).toBeDefined();
      expect(screen.getAllByText(/this job site/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/join this job site on tailgatepro/i)).toBeDefined();
    });

    it("validates the form before signing up", async () => {
      renderPage();
      openSignup();

      fireEvent.click(screen.getByRole("button", { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText(/email is required/i)).toBeDefined();
        expect(screen.getByText(/company name is required/i)).toBeDefined();
        expect(screen.getByText(/^name is required$/i)).toBeDefined();
        expect(screen.getByText(/at least 8 characters/i)).toBeDefined();
      });
      expect(signUpWithEmail).not.toHaveBeenCalled();
    });

    it("signs up with the jobsite join token and typed email, creates the profile, and goes to /projects", async () => {
      signUpWithEmail.mockResolvedValue({ session: { access_token: "t" } });
      mockCreateProfile.mockResolvedValue({ id: "u1" });
      renderPage();

      fillSignup();

      await waitFor(() => {
        expect(signUpWithEmail).toHaveBeenCalledWith("jane@acme.com", "supersecret", {
          name: "Jane Doe",
          companyName: "Acme Roofing",
          jobsiteJoinToken: TOKEN,
        });
        expect(mockCreateProfile).toHaveBeenCalledWith({ accessToken: "t" });
        expect(mockNavigate).toHaveBeenCalledWith("/projects");
      });
    });

    it("shows check-your-email with the typed address and skips profile creation when no session comes back", async () => {
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
        expect(toast.error).toHaveBeenCalledWith("Could not join this job site."),
      );
    });
  });

  describe("signed in", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { email: "jane@acme.com" },
        loading: false,
        signUpWithEmail,
      });
    });

    it("lets a subcontractor admin join, then goes to /projects", async () => {
      renderPage();

      expect(screen.queryByLabelText(/your company name/i)).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: /join this job site/i }));

      await waitFor(() => expect(mockAcceptJoinLink).toHaveBeenCalledWith(TOKEN));
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/projects"));
    });

    it("lets a safety manager join too", () => {
      mockUseCurrentUser.mockReturnValue({ isGc: false, role: "safety_manager", isLoading: false });
      renderPage();
      expect(screen.getByRole("button", { name: /join this job site/i })).toBeDefined();
    });

    it("stays put when joining fails (the hook already toasts)", async () => {
      mockAcceptJoinLink.mockRejectedValue(new Error("nope"));
      renderPage();

      fireEvent.click(screen.getByRole("button", { name: /join this job site/i }));

      await waitFor(() => expect(mockAcceptJoinLink).toHaveBeenCalled());
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("waits for the profile before offering to join", () => {
      mockUseCurrentUser.mockReturnValue({ isGc: false, role: null, isLoading: true });
      renderPage();

      expect(screen.getByText(/checking your account/i)).toBeDefined();
      expect(screen.queryByRole("button", { name: /join this job site/i })).toBeNull();
    });

    it("blocks a GC account with no Log out offered", () => {
      mockUseCurrentUser.mockReturnValue({ isGc: true, role: "admin", isLoading: false });
      renderPage();

      expect(screen.getByRole("alert").textContent).toMatch(
        /general contractor accounts can't join/i,
      );
      expect(screen.queryByRole("button", { name: /join this job site/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /log out/i })).toBeNull();
    });

    it("blocks a foreman and points them to an admin, with no Log out offered", () => {
      mockUseCurrentUser.mockReturnValue({ isGc: false, role: "foreman", isLoading: false });
      renderPage();

      expect(screen.getByRole("alert").textContent).toMatch(
        /only an admin or safety manager/i,
      );
      expect(screen.queryByRole("button", { name: /join this job site/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /log out/i })).toBeNull();
    });

    it("falls back to generic wording when the jobsite name is missing", () => {
      mockUsePreview.mockReturnValue({
        preview: { ...preview, jobsiteName: null },
        isLoading: false,
        isError: false,
      });
      renderPage();

      expect(screen.getByRole("heading", { name: /join this job site/i })).toBeDefined();
    });
  });
});
