import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { MemoryRouter } from "react-router-dom";

import { GcPolicyPush } from "../../../src/pages/GcPolicyPush/GcPolicyPush";
import theme from "../../../src/styles/theme";

const mockUseAuth = vi.fn();
const mockUseOnlineStatus = vi.fn();
const mockUseCurrentUser = vi.fn();
const mockUseGcPolicyPush = vi.fn();

vi.mock("../../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));
vi.mock("../../../src/context/online-status", () => ({
  useOnlineStatus: () => mockUseOnlineStatus(),
}));
vi.mock("../../../src/hooks/useCurrentUser", () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));
vi.mock("../../../src/hooks/useGcPolicyPush", () => ({
  useGcPolicyPush: (...args: unknown[]) => mockUseGcPolicyPush(...args),
}));

// The feature components have their own tests; stub them so this page test
// stays focused on page state (guards, plan gate, role gate, loading/error).
vi.mock("../../../src/features/gc-policy-push", () => ({
  CurrentPushCard: ({ push }: { push: { talkId: string | null } }) => (
    <div data-testid="current-push-card">{push.talkId ?? "none"}</div>
  ),
  PushTopicForm: () => <div data-testid="push-topic-form">Push form</div>,
  ClearPushButton: () => <div data-testid="clear-push-button">Clear button</div>,
  PolicyComplianceTable: ({ jobsites }: { jobsites: unknown[] }) => (
    <div data-testid="compliance-table">{jobsites.length} jobsites</div>
  ),
  PolicyPushUpgradeNotice: () => <div data-testid="upgrade-notice">Upgrade notice</div>,
}));

const noPush = {
  talkId: null,
  talkTitle: null,
  pushedAt: null,
  pushedByName: null,
  jobsites: [],
  totals: { subs: 0, logged: 0, missing: 0 },
};

const activePush = {
  talkId: "talk-1",
  talkTitle: "Fall Protection",
  pushedAt: "2026-09-01T00:00:00.000Z",
  pushedByName: "Jane Admin",
  jobsites: [{ id: "jobsite-1", name: "Downtown Tower", subs: [] }],
  totals: { subs: 1, logged: 0, missing: 1 },
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <GcPolicyPush />
      </ThemeProvider>
    </MemoryRouter>,
  );

describe("GcPolicyPush page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { email: "gc@example.com" }, loading: false });
    mockUseOnlineStatus.mockReturnValue({ isOnline: true });
    mockUseCurrentUser.mockReturnValue({ plan: "gc-portfolio", role: "admin" });
    mockUseGcPolicyPush.mockReturnValue({
      policyPush: noPush,
      isLoading: false,
      isError: false,
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

  it("shows a spinner while the policy push query is loading", () => {
    mockUseGcPolicyPush.mockReturnValue({ policyPush: null, isLoading: true, isError: false });
    renderPage();
    expect(screen.getByRole("status", { name: /loading policy push/i })).toBeDefined();
  });

  it("shows an error message when the policy push query fails", () => {
    mockUseGcPolicyPush.mockReturnValue({ policyPush: null, isLoading: false, isError: true });
    renderPage();
    expect(screen.getByRole("alert")).toBeDefined();
  });

  it("shows an offline note when offline", () => {
    mockUseOnlineStatus.mockReturnValue({ isOnline: false });
    renderPage();
    expect(screen.getByText(/you're offline/i)).toBeDefined();
  });

  it("calls useGcPolicyPush with today's date and tzOffset", () => {
    renderPage();
    const [date, tzOffset] = mockUseGcPolicyPush.mock.calls[0];
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(typeof tzOffset).toBe("number");
  });

  it("renders the current push card, and no compliance table or clear button when nothing is pushed", () => {
    renderPage();
    expect(screen.getByTestId("current-push-card").textContent).toBe("none");
    expect(screen.queryByTestId("compliance-table")).toBeNull();
    expect(screen.queryByTestId("clear-push-button")).toBeNull();
  });

  it("renders the compliance table and clear button once a topic is pushed", () => {
    mockUseGcPolicyPush.mockReturnValue({
      policyPush: activePush,
      isLoading: false,
      isError: false,
    });
    renderPage();
    expect(screen.getByTestId("compliance-table").textContent).toBe("1 jobsites");
    expect(screen.getByTestId("clear-push-button")).toBeDefined();
  });

  it("shows the push form for a manager (admin/safety_manager)", () => {
    renderPage();
    expect(screen.getByTestId("push-topic-form")).toBeDefined();
  });

  it("hides the push form and clear button for a non-manager (e.g. a site-scoped superintendent)", () => {
    mockUseCurrentUser.mockReturnValue({ plan: "gc-portfolio", role: "superintendent" });
    mockUseGcPolicyPush.mockReturnValue({
      policyPush: activePush,
      isLoading: false,
      isError: false,
    });
    renderPage();
    expect(screen.queryByTestId("push-topic-form")).toBeNull();
    expect(screen.queryByTestId("clear-push-button")).toBeNull();
    // Read-only view is still shown.
    expect(screen.getByTestId("compliance-table")).toBeDefined();
  });

  it("shows an upgrade notice instead of data for a non-Portfolio GC, without a spinner or error", () => {
    mockUseCurrentUser.mockReturnValue({ plan: "gc-free", role: "admin" });
    mockUseGcPolicyPush.mockReturnValue({ policyPush: null, isLoading: false, isError: false });

    renderPage();

    expect(screen.getByTestId("upgrade-notice")).toBeDefined();
    expect(screen.queryByTestId("current-push-card")).toBeNull();
    expect(screen.queryByRole("status", { name: /loading policy push/i })).toBeNull();
  });
});
