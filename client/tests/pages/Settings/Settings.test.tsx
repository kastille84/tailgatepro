import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "styled-components";

import { Settings } from "../../../src/pages/Settings/Settings";
import theme from "../../../src/styles/theme";

const mockUseAuth = vi.fn();
const mockUseCurrentUser = vi.fn();
const mockUseCompanyLogo = vi.fn();
const mockUseUploadCompanyLogo = vi.fn();

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

// LogoUpload has its own tests; stub it here so the page test stays focused
// on page-level gating (upsell vs. upload control), matching Projects.test.tsx.
vi.mock("../../../src/features/company-settings", () => ({
  LogoUpload: ({ currentLogoUrl }: { currentLogoUrl: string | null }) => (
    <div data-testid="logo-upload">logo: {currentLogoUrl ?? "none"}</div>
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
    mockUseCurrentUser.mockReturnValue({ hasBrandingAccess: false });
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
