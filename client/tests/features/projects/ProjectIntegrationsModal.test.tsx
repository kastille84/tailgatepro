import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { MemoryRouter } from "react-router-dom";

import { ProjectIntegrationsModal } from "../../../src/features/projects/ProjectIntegrationsModal";
import theme from "../../../src/styles/theme";
import type { Project } from "../../../src/interfaces/project";

const mockUseOnlineStatus = vi.fn();
const mockUseIntegrations = vi.fn();
const mockConnect = vi.fn();
const mockDisconnect = vi.fn();
const mockRetry = vi.fn();

vi.mock("../../../src/context/online-status", () => ({
  useOnlineStatus: () => mockUseOnlineStatus(),
}));
vi.mock("../../../src/hooks/useProjectIntegrations", () => ({
  useProjectIntegrations: (id: string) => mockUseIntegrations(id),
}));
vi.mock("../../../src/hooks/useConnectProjectIntegration", () => ({
  useConnectProjectIntegration: () => ({ connectIntegration: mockConnect, isConnecting: false }),
}));
vi.mock("../../../src/hooks/useDisconnectProjectIntegration", () => ({
  useDisconnectProjectIntegration: () => ({ disconnectIntegration: mockDisconnect, isDisconnecting: false }),
}));
vi.mock("../../../src/hooks/useRetryProjectPush", () => ({
  useRetryProjectPush: () => ({ retryPush: mockRetry, retryingPushId: null }),
}));
// The connect form is covered by its own test; expose its callback here.
vi.mock("../../../src/features/jobsites/IntegrationConnectForm", () => ({
  IntegrationConnectForm: ({
    config,
    onConnect,
  }: {
    config: { provider: string };
    onConnect: (values: unknown) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onConnect({ provider: config.provider, credentials: { grantKey: "gk" }, projectId: "job-1" })
      }
    >
      connect {config.provider}
    </button>
  ),
}));

const project = {
  id: "pr1",
  ownerCompanyId: "c1",
  name: "Downtown Highrise",
  gcCompanyId: null,
  gcNameCustom: "Acme GC",
  status: "active",
  archivedAt: null,
  createdAt: "x",
} as Project;

const state = (overrides = {}) => ({
  enterprise: true,
  integrations: [],
  recentPushes: [],
  isLoading: false,
  isError: false,
  ...overrides,
});

const renderModal = () =>
  render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <ProjectIntegrationsModal project={project} onClose={vi.fn()} />
      </ThemeProvider>
    </MemoryRouter>,
  );

describe("ProjectIntegrationsModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOnlineStatus.mockReturnValue({ isOnline: true });
    mockUseIntegrations.mockReturnValue(state());
  });

  it("offers Procore and JobTread (not ACC) to a Trade Enterprise sub", () => {
    renderModal();
    expect(mockUseIntegrations).toHaveBeenCalledWith("pr1");
    expect(screen.getByText("connect procore")).toBeDefined();
    expect(screen.getByText("connect jobtread")).toBeDefined();
    expect(screen.queryByText("connect acc")).toBeNull();
  });

  it("connects against this TailgatePro project", () => {
    renderModal();
    fireEvent.click(screen.getByText("connect jobtread"));
    expect(mockConnect).toHaveBeenCalledWith({
      provider: "jobtread",
      credentials: { grantKey: "gk" },
      projectId: "job-1",
      tailgateProjectId: "pr1",
    });
  });

  it("disconnects and retries against this project", () => {
    mockUseIntegrations.mockReturnValue(
      state({
        integrations: [
          { id: "i1", provider: "jobtread", externalProjectId: "job-1", externalFolderId: null, status: "error", lastError: "x" },
        ],
        recentPushes: [
          { id: "p1", meetingLogId: "m1", integrationId: "i1", status: "failed", error: "x", attemptedAt: "2026-09-30T12:00:00.000Z" },
        ],
      }),
    );
    renderModal();

    fireEvent.click(screen.getByRole("button", { name: /^retry$/i }));
    expect(mockRetry).toHaveBeenCalledWith({ pushId: "p1", projectId: "pr1" });

    fireEvent.click(screen.getByRole("button", { name: /disconnect jobtread/i }));
    expect(mockDisconnect).toHaveBeenCalledWith({ projectId: "pr1", provider: "jobtread" });
  });

  it("shows an upgrade prompt instead of the forms for a non-Enterprise sub", () => {
    mockUseIntegrations.mockReturnValue(state({ enterprise: false }));
    renderModal();
    expect(screen.getByText(/part of trade enterprise/i)).toBeDefined();
    expect(screen.getByRole("link", { name: /see plans/i }).getAttribute("href")).toBe("/pricing");
    expect(screen.queryByText(/connect procore/i)).toBeNull();
  });

  it("does not show the upgrade prompt while loading or on error", () => {
    mockUseIntegrations.mockReturnValue(state({ enterprise: false, isLoading: true }));
    const { unmount } = renderModal();
    expect(screen.queryByText(/part of trade enterprise/i)).toBeNull();
    unmount();

    mockUseIntegrations.mockReturnValue(state({ enterprise: false, isError: true }));
    renderModal();
    expect(screen.queryByText(/part of trade enterprise/i)).toBeNull();
    expect(screen.getByRole("alert").textContent).toMatch(/could not load integrations/i);
  });
});
