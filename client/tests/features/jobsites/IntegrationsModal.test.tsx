import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { IntegrationsModal } from "../../../src/features/jobsites/IntegrationsModal";
import theme from "../../../src/styles/theme";
import type { Jobsite } from "../../../src/interfaces/jobsite";

const mockUseOnlineStatus = vi.fn();
const mockUseIntegrations = vi.fn();
const mockConnect = vi.fn();
const mockDisconnect = vi.fn();
const mockRetry = vi.fn();
let retryingPushId: string | null = null;

vi.mock("../../../src/context/online-status", () => ({
  useOnlineStatus: () => mockUseOnlineStatus(),
}));
vi.mock("../../../src/hooks/useJobsiteIntegrations", () => ({
  useJobsiteIntegrations: (id: string) => mockUseIntegrations(id),
}));
vi.mock("../../../src/hooks/useConnectIntegration", () => ({
  useConnectIntegration: () => ({ connectIntegration: mockConnect, isConnecting: false }),
}));
vi.mock("../../../src/hooks/useDisconnectIntegration", () => ({
  useDisconnectIntegration: () => ({
    disconnectIntegration: mockDisconnect,
    isDisconnecting: false,
  }),
}));
vi.mock("../../../src/hooks/useRetryPush", () => ({
  useRetryPush: () => ({ retryPush: mockRetry, retryingPushId }),
}));
// The connect form is covered by its own test.
vi.mock("../../../src/features/jobsites/IntegrationConnectForm", () => ({
  IntegrationConnectForm: ({
    config,
    onConnect,
  }: {
    config: { provider: string };
    onConnect: (values: unknown) => void;
  }) => (
    <div>
      connect form: {config.provider}
      <button
        type="button"
        onClick={() =>
          onConnect({ provider: config.provider, credentials: { clientId: "a" }, projectId: "77" })
        }
      >
        submit {config.provider}
      </button>
    </div>
  ),
}));

const jobsite = {
  id: "j1",
  gcCompanyId: "gc-1",
  name: "Riverside",
  status: "active",
  archivedAt: null,
  createdBySub: false,
  createdAt: "x",
  subcontractors: [],
} as Jobsite;

const procoreIntegration = {
  id: "i1",
  provider: "procore" as const,
  externalProjectId: "77",
  externalFolderId: null,
  status: "connected" as const,
  lastError: null,
};

const render_ = (onClose = vi.fn()) =>
  render(
    <ThemeProvider theme={theme}>
      <IntegrationsModal jobsite={jobsite} onClose={onClose} />
    </ThemeProvider>,
  );

describe("IntegrationsModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    retryingPushId = null;
    mockUseOnlineStatus.mockReturnValue({ isOnline: true });
    mockUseIntegrations.mockReturnValue({
      integrations: [],
      recentPushes: [],
      isLoading: false,
      isError: false,
    });
  });

  it("shows a connect form for each provider when nothing is connected", () => {
    render_();
    expect(mockUseIntegrations).toHaveBeenCalledWith("j1");
    expect(screen.getByText("connect form: procore")).toBeDefined();
    expect(screen.getByText("connect form: acc")).toBeDefined();
  });

  it("connects against this jobsite", () => {
    render_();
    fireEvent.click(screen.getByRole("button", { name: "submit acc" }));
    expect(mockConnect).toHaveBeenCalledWith({
      provider: "acc",
      credentials: { clientId: "a" },
      projectId: "77",
      jobsiteId: "j1",
    });
  });

  it("shows a spinner while loading", () => {
    mockUseIntegrations.mockReturnValue({ integrations: [], recentPushes: [], isLoading: true, isError: false });
    render_();
    expect(screen.getByRole("status")).toBeDefined();
    expect(screen.queryByText(/connect form/)).toBeNull();
  });

  it("shows an error when loading fails", () => {
    mockUseIntegrations.mockReturnValue({ integrations: [], recentPushes: [], isLoading: false, isError: true });
    render_();
    expect(screen.getByRole("alert").textContent).toMatch(/could not load integrations/i);
  });

  it("warns when offline", () => {
    mockUseOnlineStatus.mockReturnValue({ isOnline: false });
    render_();
    expect(screen.getByText(/you.re offline/i)).toBeDefined();
  });

  it("shows a connected provider with its project and a Disconnect button", () => {
    mockUseIntegrations.mockReturnValue({
      integrations: [{ ...procoreIntegration, externalFolderId: "12" }],
      recentPushes: [],
      isLoading: false,
      isError: false,
    });
    render_();

    expect(screen.getByText("Connected")).toBeDefined();
    expect(screen.getByText(/project 77, folder 12/i)).toBeDefined();
    expect(screen.getByText("connect form: acc")).toBeDefined();
    expect(screen.queryByText("connect form: procore")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /disconnect procore/i }));
    expect(mockDisconnect).toHaveBeenCalledWith({ jobsiteId: "j1", provider: "procore" });
  });

  it("omits the folder when none is set", () => {
    mockUseIntegrations.mockReturnValue({
      integrations: [procoreIntegration],
      recentPushes: [],
      isLoading: false,
      isError: false,
    });
    render_();
    expect(screen.getByText(/^project 77$/i)).toBeDefined();
  });

  it("flags an integration in error and lists failed sends with Retry", () => {
    mockUseIntegrations.mockReturnValue({
      integrations: [{ ...procoreIntegration, status: "error", lastError: "Procore rejected the request (403)" }],
      recentPushes: [
        { id: "p1", meetingLogId: "m1", integrationId: "i1", status: "failed", error: "x", attemptedAt: "2026-09-30T12:00:00.000Z" },
        { id: "p2", meetingLogId: "m2", integrationId: "i1", status: "sent", error: null, attemptedAt: "2026-09-30T12:00:00.000Z" },
        { id: "p3", meetingLogId: "m3", integrationId: "other", status: "failed", error: "x", attemptedAt: "2026-09-30T12:00:00.000Z" },
      ],
      isLoading: false,
      isError: false,
    });
    render_();

    expect(screen.getByText("Needs attention")).toBeDefined();
    expect(screen.getByRole("alert").textContent).toMatch(/last send failed: procore rejected/i);
    expect(screen.getAllByRole("button", { name: /^retry$/i })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: /^retry$/i }));
    expect(mockRetry).toHaveBeenCalledWith({ pushId: "p1", jobsiteId: "j1" });
  });

  it("disables Retry and Disconnect while offline", () => {
    mockUseOnlineStatus.mockReturnValue({ isOnline: false });
    mockUseIntegrations.mockReturnValue({
      integrations: [procoreIntegration],
      recentPushes: [
        { id: "p1", meetingLogId: "m1", integrationId: "i1", status: "failed", error: "x", attemptedAt: "2026-09-30T12:00:00.000Z" },
      ],
      isLoading: false,
      isError: false,
    });
    render_();

    expect((screen.getByRole("button", { name: /^retry$/i }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /disconnect procore/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("marks the push being retried as loading", () => {
    retryingPushId = "p1";
    mockUseIntegrations.mockReturnValue({
      integrations: [procoreIntegration],
      recentPushes: [
        { id: "p1", meetingLogId: "m1", integrationId: "i1", status: "failed", error: "x", attemptedAt: "2026-09-30T12:00:00.000Z" },
      ],
      isLoading: false,
      isError: false,
    });
    render_();
    expect(screen.getByRole("button", { name: /retry/i }).getAttribute("aria-busy")).toBe("true");
  });
});
