import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "styled-components";

import { Settings } from "../../../src/pages/Settings/Settings";
import theme from "../../../src/styles/theme";

const mockUseAuth = vi.fn();
const mockUseCurrentUser = vi.fn();
const mockUseCompanyLogo = vi.fn();
const mockUseUploadCompanyLogo = vi.fn();
const mockUseJoinCode = vi.fn();
const mockUseBillingStatus = vi.fn();
const mockOpenPortal = vi.fn();
const mockUseBillingPortal = vi.fn();
const mockUseCheckoutReturn = vi.fn();

vi.mock("../../../src/hooks/useBillingStatus", () => ({
  useBillingStatus: () => mockUseBillingStatus(),
}));
vi.mock("../../../src/hooks/useBillingPortal", () => ({
  useBillingPortal: () => mockUseBillingPortal(),
}));
vi.mock("../../../src/hooks/useCheckoutReturn", () => ({
  useCheckoutReturn: () => mockUseCheckoutReturn(),
}));

vi.mock("../../../src/hooks/useJoinCode", () => ({
  useJoinCode: () => mockUseJoinCode(),
}));

vi.mock("../../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));
vi.mock("../../../src/hooks/useCurrentUser", () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));
vi.mock("../../../src/hooks/useCompanyLogo", () => ({
  useCompanyLogo: () => mockUseCompanyLogo(),
}));
vi.mock("../../../src/hooks/useUploadCompanyLogo", () => ({
  useUploadCompanyLogo: () => mockUseUploadCompanyLogo(),
}));

// LogoUpload and JoinCodeCard have their own tests; stub them here so the page
// test stays focused on page-level gating (upsell vs. upload control, GC-only
// join code), matching Projects.test.tsx.
vi.mock("../../../src/features/company-settings", () => ({
  LogoUpload: ({ currentLogoUrl }: { currentLogoUrl: string | null }) => (
    <div data-testid="logo-upload">logo: {currentLogoUrl ?? "none"}</div>
  ),
  JoinCodeCard: ({
    joinCode,
    isLoading,
    isError,
  }: {
    joinCode: string | null;
    isLoading: boolean;
    isError: boolean;
  }) => (
    <div data-testid="join-code-card">
      code: {joinCode ?? "none"} loading: {String(isLoading)} error:{" "}
      {String(isError)}
    </div>
  ),
  InviteTeammateForm: () => <div data-testid="invite-teammate-form" />,
  BillingSection: ({
    planName,
    billing,
    isLoading,
    isError,
    isConfirming,
    isOpening,
    onManage,
  }: {
    planName: string | null;
    billing: { subscriptionStatus: string | null } | null;
    isLoading: boolean;
    isError: boolean;
    isConfirming: boolean;
    isOpening: boolean;
    onManage: () => void;
  }) => (
    <div data-testid="billing-section">
      plan: {planName ?? "none"} status: {billing?.subscriptionStatus ?? "none"}{" "}
      loading: {String(isLoading)} error: {String(isError)} confirming:{" "}
      {String(isConfirming)} opening: {String(isOpening)}
      <button type="button" onClick={onManage}>
        manage
      </button>
    </div>
  ),
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <Settings />
      </ThemeProvider>
    </MemoryRouter>,
  );

describe("Settings page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { email: "a@b.com" }, loading: false });
    mockUseCurrentUser.mockReturnValue({ hasBrandingAccess: false, isGc: false });
    mockUseJoinCode.mockReturnValue({
      joinCode: null,
      isLoading: false,
      isError: false,
    });
    mockUseBillingStatus.mockReturnValue({
      billing: null,
      isLoading: false,
      isError: false,
    });
    mockUseBillingPortal.mockReturnValue({
      openPortal: mockOpenPortal,
      isOpening: false,
    });
    mockUseCheckoutReturn.mockReturnValue({ isConfirming: false });
    mockUseCompanyLogo.mockReturnValue({ logoUrl: null, isLoading: false });
    mockUseUploadCompanyLogo.mockReturnValue({
      uploadLogo: vi.fn(),
      isUploading: false,
    });
  });

  it("shows a loading status while auth resolves", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    renderPage();
    expect(screen.getByText(/loading/i)).toBeDefined();
  });

  it("shows an access-denied fallback when there is no user", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    renderPage();
    expect(screen.getByText(/access denied/i)).toBeDefined();
  });

  it("renders the footer", () => {
    renderPage();
    expect(
      screen.getByText(new RegExp(`© ${new Date().getFullYear()} TailgatePro`, "i")),
    ).toBeTruthy();
  });

  it("shows the Trade Pro upsell, not the upload control, for a basic-tier company", () => {
    mockUseCurrentUser.mockReturnValue({ hasBrandingAccess: false });
    renderPage();

    expect(screen.getByText(/custom branding is a trade pro feature/i)).toBeDefined();
    expect(screen.queryByTestId("logo-upload")).toBeNull();
    expect(screen.getByRole("link", { name: /upgrade to trade pro/i })).toHaveProperty(
      "href",
      expect.stringContaining("/pricing"),
    );
  });

  it.each(["premium", "enterprise"])(
    "renders the upload control, not the upsell, for a %s-tier company",
    (tier) => {
      mockUseCurrentUser.mockReturnValue({ hasBrandingAccess: true, tier });
      renderPage();

      expect(screen.getByTestId("logo-upload")).toBeDefined();
      expect(
        screen.queryByText(/custom branding is a trade pro feature/i),
      ).toBeNull();
    },
  );

  it("shows the GC Site Pro upsell, not the Trade Pro one, for a GC company", () => {
    mockUseCurrentUser.mockReturnValue({ hasBrandingAccess: false, isGc: true });
    renderPage();

    expect(
      screen.getByText(/custom branding is a gc site pro feature/i),
    ).toBeDefined();
    expect(
      screen.queryByText(/custom branding is a trade pro feature/i),
    ).toBeNull();
    expect(
      screen.getByRole("link", { name: /upgrade to gc site pro/i }),
    ).toHaveProperty("href", expect.stringContaining("/pricing"));
  });

  it("shows the join code section, fed by useJoinCode, for a GC company", () => {
    mockUseCurrentUser.mockReturnValue({
      hasBrandingAccess: false,
      isGc: true,
    });
    mockUseJoinCode.mockReturnValue({
      joinCode: "K7M2Q9XB",
      isLoading: false,
      isError: false,
    });
    renderPage();

    expect(screen.getByText(/subcontractor join code/i)).toBeDefined();
    expect(screen.getByTestId("join-code-card").textContent).toContain(
      "code: K7M2Q9XB",
    );
  });

  it("passes the join code's loading and error state through to the card", () => {
    mockUseCurrentUser.mockReturnValue({
      hasBrandingAccess: false,
      isGc: true,
    });
    mockUseJoinCode.mockReturnValue({
      joinCode: null,
      isLoading: true,
      isError: true,
    });
    renderPage();

    const text = screen.getByTestId("join-code-card").textContent;
    expect(text).toContain("loading: true");
    expect(text).toContain("error: true");
  });

  it("hides the join code section for a company that is not a GC", () => {
    renderPage();

    expect(screen.queryByText(/subcontractor join code/i)).toBeNull();
    expect(screen.queryByTestId("join-code-card")).toBeNull();
  });

  describe("billing section", () => {
    it("shows the billing section, fed by the billing hooks, to a manager", () => {
      mockUseCurrentUser.mockReturnValue({
        hasBrandingAccess: false,
        isManagerRole: true,
        plan: "trade-pro",
      });
      mockUseBillingStatus.mockReturnValue({
        billing: { subscriptionStatus: "active" },
        isLoading: false,
        isError: true,
      });
      mockUseBillingPortal.mockReturnValue({
        openPortal: mockOpenPortal,
        isOpening: true,
      });
      mockUseCheckoutReturn.mockReturnValue({ isConfirming: true });
      renderPage();

      expect(screen.getByRole("heading", { name: "Billing" })).toBeDefined();
      const text = screen.getByTestId("billing-section").textContent;
      expect(text).toContain("plan: Trade Pro");
      expect(text).toContain("status: active");
      expect(text).toContain("error: true");
      expect(text).toContain("confirming: true");
      expect(text).toContain("opening: true");
    });

    it("resolves a GC plan id to its name and passes null for an unknown plan", () => {
      mockUseCurrentUser.mockReturnValue({
        hasBrandingAccess: false,
        isManagerRole: true,
        plan: "gc-portfolio",
      });
      const { unmount } = renderPage();
      expect(screen.getByTestId("billing-section").textContent).toContain(
        "plan: GC Portfolio",
      );
      unmount();

      mockUseCurrentUser.mockReturnValue({
        hasBrandingAccess: false,
        isManagerRole: true,
        plan: null,
      });
      renderPage();
      expect(screen.getByTestId("billing-section").textContent).toContain(
        "plan: none",
      );
    });

    it("opens the billing portal when the section asks to manage billing", () => {
      mockUseCurrentUser.mockReturnValue({
        hasBrandingAccess: false,
        isManagerRole: true,
      });
      renderPage();

      fireEvent.click(screen.getByRole("button", { name: "manage" }));
      expect(mockOpenPortal).toHaveBeenCalledTimes(1);
    });

    it("hides the billing section from a non-manager", () => {
      mockUseCurrentUser.mockReturnValue({
        hasBrandingAccess: false,
        isManagerRole: false,
      });
      renderPage();

      expect(screen.queryByTestId("billing-section")).toBeNull();
    });
  });

  it.each(["admin", "safety_manager"])(
    "shows the invite-a-teammate section for a %s",
    (role) => {
      mockUseCurrentUser.mockReturnValue({ hasBrandingAccess: false, role });
      renderPage();

      expect(screen.getByText(/invite a teammate/i)).toBeDefined();
      expect(screen.getByTestId("invite-teammate-form")).toBeDefined();
    },
  );

  it("hides the invite-a-teammate section for a foreman", () => {
    mockUseCurrentUser.mockReturnValue({ hasBrandingAccess: false, role: "foreman" });
    renderPage();

    expect(screen.queryByText(/invite a teammate/i)).toBeNull();
    expect(screen.queryByTestId("invite-teammate-form")).toBeNull();
  });

  it("passes the current logo URL through to LogoUpload", () => {
    mockUseCurrentUser.mockReturnValue({ hasBrandingAccess: true });
    mockUseCompanyLogo.mockReturnValue({
      logoUrl: "https://signed.example/logo.png",
      isLoading: false,
    });
    renderPage();

    expect(screen.getByTestId("logo-upload").textContent).toContain(
      "https://signed.example/logo.png",
    );
  });
});
