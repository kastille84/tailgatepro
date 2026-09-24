import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { JobsiteManager } from "../../../src/features/jobsites/JobsiteManager";
import theme from "../../../src/styles/theme";
import type { Jobsite } from "../../../src/interfaces/jobsite";

const mockUseOnlineStatus = vi.fn();
const mockUseCurrentUser = vi.fn();
const mockUseJobsites = vi.fn();

vi.mock("../../../src/context/online-status", () => ({
  useOnlineStatus: () => mockUseOnlineStatus(),
}));
vi.mock("../../../src/hooks/useCurrentUser", () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));
vi.mock("../../../src/hooks/useJobsites", () => ({
  useJobsites: () => mockUseJobsites(),
}));

// The children have their own tests; stub them to keep this focused on
// manager state (role gating, archived filter, opening/closing modals).
vi.mock("../../../src/features/jobsites/JobsiteList", () => ({
  JobsiteList: ({
    jobsites,
    onEdit,
    onManageSubs,
  }: {
    jobsites: Jobsite[];
    onEdit?: (j: Jobsite) => void;
    onManageSubs: (j: Jobsite) => void;
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
    </div>
  ),
}));
vi.mock("../../../src/features/jobsites/JobsiteForm", () => ({
  JobsiteForm: ({
    isOpen,
    onClose,
    jobsite,
  }: {
    isOpen: boolean;
    onClose: () => void;
    jobsite?: Jobsite;
  }) =>
    isOpen ? (
      <div role="dialog">
        {jobsite ? `edit ${jobsite.id}` : "new"}
        <button type="button" onClick={onClose}>
          stub-form-close
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

const jobsite = (over: Partial<Jobsite>): Jobsite => ({
  id: "j1",
  gcCompanyId: "gc-1",
  name: "Riverside",
  status: "active",
  archivedAt: null,
  createdAt: "x",
  subcontractors: [],
  ...over,
});

const renderManager = () =>
  render(
    <ThemeProvider theme={theme}>
      <JobsiteManager />
    </ThemeProvider>,
  );

describe("JobsiteManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOnlineStatus.mockReturnValue({ isOnline: true });
    mockUseCurrentUser.mockReturnValue({ role: "admin" });
    mockUseJobsites.mockReturnValue({
      jobsites: [jobsite({})],
      isLoading: false,
      isError: false,
    });
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
    mockUseCurrentUser.mockReturnValue({ role: "safety_manager" });
    renderManager();

    expect(
      screen.getByRole("button", { name: /new job site/i }),
    ).toBeDefined();
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
