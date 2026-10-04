import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "styled-components";

import { JobsiteManager } from "../../../src/features/jobsites/JobsiteManager";
import theme from "../../../src/styles/theme";
import type { Jobsite } from "../../../src/interfaces/jobsite";

const mockUseOnlineStatus = vi.fn();
const mockUseCurrentUser = vi.fn();
const mockUseJobsites = vi.fn();
const mockUseDownloadDefenseBundle = vi.fn();
const mockUseSiteCheckoutReturn = vi.fn();

vi.mock("../../../src/context/online-status", () => ({
  useOnlineStatus: () => mockUseOnlineStatus(),
}));
vi.mock("../../../src/hooks/useCurrentUser", () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));
vi.mock("../../../src/hooks/useJobsites", () => ({
  useJobsites: () => mockUseJobsites(),
}));
vi.mock("../../../src/hooks/useSiteCheckoutReturn", () => ({
  useSiteCheckoutReturn: () => mockUseSiteCheckoutReturn(),
}));
vi.mock("../../../src/features/jobsites/SiteProCheckoutModal", () => ({
  SiteProCheckoutModal: ({
    jobsite,
    onClose,
  }: {
    jobsite: { id: string } | null;
    onClose: () => void;
  }) =>
    jobsite ? (
      <div role="dialog">
        site-pro {jobsite.id}
        <button type="button" onClick={onClose}>
          stub-site-pro-close
        </button>
      </div>
    ) : null,
}));
vi.mock("../../../src/hooks/useDownloadDefenseBundle", () => ({
  useDownloadDefenseBundle: () => mockUseDownloadDefenseBundle(),
}));

// The children have their own tests; stub them to keep this focused on
// manager state (role gating, archived filter, opening/closing modals).
vi.mock("../../../src/features/jobsites/JobsiteList", () => ({
  JobsiteList: ({
    jobsites,
    onEdit,
    onManageSubs,
    onManageMembers,
    onManageIntegrations,
    onUpgrade,
    onDownloadBundle,
    isDownloadingBundle,
  }: {
    jobsites: Jobsite[];
    onEdit?: (j: Jobsite) => void;
    onManageSubs: (j: Jobsite) => void;
    onManageMembers?: (j: Jobsite) => void;
    onManageIntegrations?: (j: Jobsite) => void;
    onUpgrade?: (j: Jobsite) => void;
    onDownloadBundle: (j: Jobsite) => void;
    isDownloadingBundle?: boolean;
    isOnline: boolean;
  }) => (
    <div data-testid="list">
      {jobsites.map((j) => j.name).join(",")}
      {jobsites[0] && (
        <button type="button" onClick={() => onManageSubs(jobsites[0])}>
          stub-subs
        </button>
      )}
      {jobsites[0] && onEdit && (
        <button type="button" onClick={() => onEdit(jobsites[0])}>
          stub-edit
        </button>
      )}
      {jobsites[0] && onManageMembers && (
        <button type="button" onClick={() => onManageMembers(jobsites[0])}>
          stub-members
        </button>
      )}
      {jobsites[0] && onManageIntegrations && (
        <button type="button" onClick={() => onManageIntegrations(jobsites[0])}>
          stub-integrations
        </button>
      )}
      {jobsites[0] && onUpgrade && (
        <button type="button" onClick={() => onUpgrade(jobsites[0])}>
          stub-upgrade
        </button>
      )}
      {jobsites[0] && (
        <button type="button" onClick={() => onDownloadBundle(jobsites[0])}>
          stub-bundle {String(isDownloadingBundle)}
        </button>
      )}
    </div>
  ),
}));
vi.mock("../../../src/features/jobsites/JobsiteForm", () => ({
  JobsiteForm: ({
    isOpen,
    onClose,
    jobsite,
    onPlanLimit,
  }: {
    isOpen: boolean;
    onClose: () => void;
    jobsite?: Jobsite;
    onPlanLimit?: () => void;
  }) =>
    isOpen ? (
      <div role="dialog">
        {jobsite ? `edit ${jobsite.id}` : "new"}
        <button type="button" onClick={onClose}>
          stub-form-close
        </button>
        <button type="button" onClick={onPlanLimit}>
          stub-form-plan-limit
        </button>
      </div>
    ) : null,
}));
vi.mock("../../../src/features/jobsites/JobsiteRosterModal", () => ({
  JobsiteRosterModal: ({
    jobsite,
    canManage,
    onClose,
  }: {
    jobsite: Jobsite;
    canManage: boolean;
    onClose: () => void;
  }) => (
    <div role="dialog">
      roster {jobsite.id} {String(canManage)}
      <button type="button" onClick={onClose}>
        stub-roster-close
      </button>
    </div>
  ),
}));
vi.mock("../../../src/features/jobsites/JobsiteMembersModal", () => ({
  JobsiteMembersModal: ({
    jobsite,
    onClose,
  }: {
    jobsite: Jobsite;
    onClose: () => void;
  }) => (
    <div role="dialog">
      members {jobsite.id}
      <button type="button" onClick={onClose}>
        stub-members-close
      </button>
    </div>
  ),
}));
vi.mock("../../../src/features/jobsites/IntegrationsModal", () => ({
  IntegrationsModal: ({
    jobsite,
    onClose,
  }: {
    jobsite: Jobsite;
    onClose: () => void;
  }) => (
    <div role="dialog">
      integrations {jobsite.id}
      <button type="button" onClick={onClose}>
        stub-integrations-close
      </button>
    </div>
  ),
}));
vi.mock("../../../src/ui_comps/progress-modal", () => ({
  ProgressModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="bundle-progress-modal" /> : null,
}));

const jobsite = (over: Partial<Jobsite>): Jobsite => ({
  id: "j1",
  gcCompanyId: "gc-1",
  name: "Riverside",
  status: "active",
  archivedAt: null,
  createdBySub: false,
  plan: "free",
  createdAt: "x",
  subcontractors: [],
  ...over,
});

const renderManager = () =>
  render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <JobsiteManager />
      </ThemeProvider>
    </MemoryRouter>,
  );

describe("JobsiteManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOnlineStatus.mockReturnValue({ isOnline: true });
    mockUseCurrentUser.mockReturnValue({ role: "admin", plan: "gc-portfolio" });
    mockUseJobsites.mockReturnValue({
      jobsites: [jobsite({})],
      isLoading: false,
      isError: false,
    });
    mockUseDownloadDefenseBundle.mockReturnValue({
      downloadBundle: vi.fn(),
      isPending: false,
    });
  });

  it("lets a manager open and close the Site Pro checkout for a jobsite", () => {
    renderManager();

    fireEvent.click(screen.getByRole("button", { name: /stub-upgrade/i }));
    expect(screen.getByRole("dialog").textContent).toContain("site-pro j1");

    fireEvent.click(screen.getByRole("button", { name: /stub-site-pro-close/i }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not offer Site Pro upgrades to a foreman", () => {
    mockUseCurrentUser.mockReturnValue({ role: "foreman", plan: "gc-portfolio" });
    renderManager();

    expect(screen.queryByRole("button", { name: /stub-upgrade/i })).toBeNull();
  });

  it("handles the return from Site Pro checkout", () => {
    renderManager();

    expect(mockUseSiteCheckoutReturn).toHaveBeenCalled();
  });

  it("shows a spinner while loading", () => {
    mockUseJobsites.mockReturnValue({
      jobsites: [],
      isLoading: true,
      isError: false,
    });
    renderManager();

    expect(screen.getByRole("status")).toBeDefined();
    expect(screen.queryByTestId("list")).toBeNull();
  });

  it("shows an error when the query fails", () => {
    mockUseJobsites.mockReturnValue({
      jobsites: [],
      isLoading: false,
      isError: true,
    });
    renderManager();

    expect(screen.getByRole("alert").textContent).toMatch(/could not load/i);
    expect(screen.queryByTestId("list")).toBeNull();
  });

  it("hides archived jobsites until Show archived is checked", () => {
    mockUseJobsites.mockReturnValue({
      jobsites: [
        jobsite({ id: "a", name: "Live" }),
        jobsite({ id: "b", name: "Old", archivedAt: "2026-09-02" }),
      ],
      isLoading: false,
      isError: false,
    });
    renderManager();

    expect(screen.getByTestId("list").textContent).toContain("Live");
    expect(screen.getByTestId("list").textContent).not.toContain("Old");

    fireEvent.click(screen.getByLabelText(/show archived/i));
    expect(screen.getByTestId("list").textContent).toContain("Live,Old");
  });

  it("lets a manager open the create form and close it", () => {
    renderManager();

    fireEvent.click(screen.getByRole("button", { name: /new job site/i }));
    expect(screen.getByRole("dialog").textContent).toContain("new");

    fireEvent.click(screen.getByRole("button", { name: /stub-form-close/i }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("swaps the create form for the 4th-site upsell when the plan's site cap is hit", () => {
    renderManager();

    fireEvent.click(screen.getByRole("button", { name: /new job site/i }));
    fireEvent.click(screen.getByRole("button", { name: /stub-form-plan-limit/i }));

    expect(screen.getByText(/currently paying \$447\/mo for 3 individual sites/i)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByText(/currently paying/i)).toBeNull();
  });

  it("opens the form in edit mode from a row", () => {
    renderManager();

    fireEvent.click(screen.getByRole("button", { name: /stub-edit/i }));
    expect(screen.getByRole("dialog").textContent).toContain("edit j1");
  });

  it("opens and closes the roster from a row, with manage rights for a manager", () => {
    renderManager();

    fireEvent.click(screen.getByRole("button", { name: /stub-subs/i }));
    expect(screen.getByRole("dialog").textContent).toContain("roster j1 true");

    fireEvent.click(screen.getByRole("button", { name: /stub-roster-close/i }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("gives a safety_manager manage rights too", () => {
    mockUseCurrentUser.mockReturnValue({ role: "safety_manager", plan: "gc-portfolio" });
    renderManager();

    expect(
      screen.getByRole("button", { name: /new job site/i }),
    ).toBeDefined();
  });

  it("opens and closes the members modal from a row on GC Portfolio", () => {
    renderManager();

    fireEvent.click(screen.getByRole("button", { name: /stub-members/i }));
    expect(screen.getByRole("dialog").textContent).toContain("members j1");

    fireEvent.click(screen.getByRole("button", { name: /stub-members-close/i }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens and closes the integrations modal for a manager", () => {
    renderManager();

    fireEvent.click(screen.getByRole("button", { name: /stub-integrations$/i }));
    expect(screen.getByRole("dialog").textContent).toContain("integrations j1");

    fireEvent.click(screen.getByRole("button", { name: /stub-integrations-close/i }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("hides Integrations for a foreman", () => {
    mockUseCurrentUser.mockReturnValue({ role: "foreman", plan: "gc-portfolio" });
    renderManager();

    expect(screen.queryByRole("button", { name: /stub-integrations$/i })).toBeNull();
  });

  it("hides the Team button on a GC plan below Portfolio", () => {
    mockUseCurrentUser.mockReturnValue({ role: "admin", plan: "gc-free" });
    renderManager();

    expect(screen.queryByRole("button", { name: /stub-members/i })).toBeNull();
  });

  it("hides the Team button for a foreman even on Portfolio", () => {
    mockUseCurrentUser.mockReturnValue({ role: "foreman", plan: "gc-portfolio" });
    renderManager();

    expect(screen.queryByRole("button", { name: /stub-members/i })).toBeNull();
  });

  it("makes the view read-only for a foreman", () => {
    mockUseCurrentUser.mockReturnValue({ role: "foreman" });
    renderManager();

    expect(screen.queryByRole("button", { name: /new job site/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /stub-edit/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /stub-subs/i }));
    expect(screen.getByRole("dialog").textContent).toContain("roster j1 false");
  });

  it("treats a not-yet-loaded profile as read-only", () => {
    mockUseCurrentUser.mockReturnValue({ role: null });
    renderManager();

    expect(screen.queryByRole("button", { name: /new job site/i })).toBeNull();
  });

  it("wires a Defense Bundle click through to useDownloadDefenseBundle's mutate function", () => {
    const downloadBundle = vi.fn();
    mockUseDownloadDefenseBundle.mockReturnValue({ downloadBundle, isPending: true });
    renderManager();

    expect(screen.getByRole("button", { name: /stub-bundle true/i })).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /stub-bundle/i }));
    expect(downloadBundle).toHaveBeenCalledWith(jobsite({}));
  });

  it("shows the Defense Bundle progress modal while a bundle download is pending", () => {
    mockUseDownloadDefenseBundle.mockReturnValue({ downloadBundle: vi.fn(), isPending: true });
    renderManager();

    expect(screen.getByTestId("bundle-progress-modal")).toBeDefined();
  });

  it("hides the Defense Bundle progress modal when nothing is downloading", () => {
    renderManager();

    expect(screen.queryByTestId("bundle-progress-modal")).toBeNull();
  });

  it("explains and disables creating while offline", () => {
    mockUseOnlineStatus.mockReturnValue({ isOnline: false });
    renderManager();

    expect(screen.getByRole("status").textContent).toMatch(/you're offline/i);
    expect(
      (screen.getByRole("button", { name: /new job site/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
