import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { MemoryRouter } from "react-router-dom";

import { MeetingFlow } from "../../../src/pages/MeetingFlow/MeetingFlow";
import theme from "../../../src/styles/theme";

const mockUseAuth = vi.fn();
vi.mock("../../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

// Lazily-loaded, same as ContentLibrary.test.tsx mocks TalkForm by its file
// path -- proves MeetingFlow wires the Suspense boundary correctly without
// pulling the wizard's own (separately-tested) logic into this suite.
vi.mock("../../../src/features/meeting-flow/MeetingWizard", () => ({
  MeetingWizard: () => <div data-testid="meeting-wizard">wizard</div>,
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <MeetingFlow />
      </ThemeProvider>
    </MemoryRouter>,
  );

describe("MeetingFlow page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading status while auth resolves", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    renderPage();
    expect(screen.getByRole("status").textContent).toMatch(/loading/i);
  });

  it("shows an access-denied fallback when there is no user", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    renderPage();
    expect(screen.getByRole("status").textContent).toMatch(/access denied/i);
  });

  it("renders the lazily-loaded wizard inside a Suspense boundary once signed in", async () => {
    mockUseAuth.mockReturnValue({
      user: { email: "a@b.com" },
      loading: false,
    });
    renderPage();

    expect(await screen.findByTestId("meeting-wizard")).toBeDefined();
    expect(
      screen.getByRole("heading", { name: /run a toolbox talk/i }),
    ).toBeDefined();
  });

  it("renders the shared footer branding", async () => {
    mockUseAuth.mockReturnValue({
      user: { email: "a@b.com" },
      loading: false,
    });
    renderPage();

    await screen.findByTestId("meeting-wizard");
    expect(
      screen.getByText(
        new RegExp(`© ${new Date().getFullYear()} TailgatePro`, "i"),
      ),
    ).toBeTruthy();
  });
});
