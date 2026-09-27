import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { MemoryRouter } from "react-router-dom";

import { JobsiteMembersModal } from "../../../src/features/jobsites/JobsiteMembersModal";
import theme from "../../../src/styles/theme";
import type { Jobsite } from "../../../src/interfaces/jobsite";
import { PlanLimitError } from "../../../src/utils/PlanLimitError";

const mockUseOnlineStatus = vi.fn();
const mockUseJobsiteMembers = vi.fn();
const mockUseSetJobsiteMembers = vi.fn();
const mockSetMembers = vi.fn();

vi.mock("../../../src/context/online-status", () => ({
  useOnlineStatus: () => mockUseOnlineStatus(),
}));
vi.mock("../../../src/hooks/useJobsiteMembers", () => ({
  useJobsiteMembers: (jobsiteId: string) => mockUseJobsiteMembers(jobsiteId),
}));
vi.mock("../../../src/hooks/useSetJobsiteMembers", () => ({
  useSetJobsiteMembers: () => mockUseSetJobsiteMembers(),
}));

const jobsite: Jobsite = {
  id: "j1",
  gcCompanyId: "gc-1",
  name: "Riverside",
  status: "active",
  archivedAt: null,
  createdBySub: false,
  createdAt: "x",
  subcontractors: [],
};

const members = [
  { userId: "u-1", name: "Ann", assigned: true },
  { userId: "u-2", name: "Bob", assigned: false },
];

const renderModal = (onClose = vi.fn()) =>
  render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <JobsiteMembersModal jobsite={jobsite} onClose={onClose} />
      </ThemeProvider>
    </MemoryRouter>,
  );

describe("JobsiteMembersModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOnlineStatus.mockReturnValue({ isOnline: true });
    mockSetMembers.mockResolvedValue({ members });
    mockUseSetJobsiteMembers.mockReturnValue({
      setJobsiteMembers: mockSetMembers,
      isSaving: false,
      planLimitError: null,
    });
    mockUseJobsiteMembers.mockReturnValue({ members, isLoading: false, isError: false });
  });

  it("shows a spinner while loading, with no checklist or Save button", () => {
    mockUseJobsiteMembers.mockReturnValue({ members: [], isLoading: true, isError: false });
    renderModal();

    expect(screen.getByRole("status")).toBeDefined();
    expect(screen.queryByRole("button", { name: /^save$/i })).toBeNull();
  });

  it("shows an error when the query fails", () => {
    mockUseJobsiteMembers.mockReturnValue({ members: [], isLoading: false, isError: true });
    renderModal();

    expect(screen.getByRole("alert").textContent).toMatch(/could not load/i);
    expect(screen.queryByRole("button", { name: /^save$/i })).toBeNull();
  });

  it("explains there are no superintendents yet when the company has none", () => {
    mockUseJobsiteMembers.mockReturnValue({ members: [], isLoading: false, isError: false });
    renderModal();

    expect(screen.getByText(/no superintendents yet/i)).toBeDefined();
    expect(screen.queryByRole("button", { name: /^save$/i })).toBeNull();
  });

  it("checks assigned members and leaves unassigned ones unchecked", () => {
    renderModal();

    expect((screen.getByLabelText("Ann") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Bob") as HTMLInputElement).checked).toBe(false);
  });

  it("toggles a member and saves the full replacement set, then closes", async () => {
    const onClose = vi.fn();
    renderModal(onClose);

    fireEvent.click(screen.getByLabelText("Bob"));
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(mockSetMembers).toHaveBeenCalledWith({
        jobsiteId: "j1",
        userIds: expect.arrayContaining(["u-1", "u-2"]),
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("unchecking an assigned member removes it from the saved set", async () => {
    renderModal();

    fireEvent.click(screen.getByLabelText("Ann"));
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(mockSetMembers).toHaveBeenCalledWith({ jobsiteId: "j1", userIds: [] }),
    );
  });

  it("does not re-seed the selection when the member list changes after the first load", () => {
    renderModal();

    fireEvent.click(screen.getByLabelText("Bob"));
    expect((screen.getByLabelText("Bob") as HTMLInputElement).checked).toBe(true);
  });

  it("stays open and leaves the selection when saving fails (the hook already toasts)", async () => {
    mockSetMembers.mockRejectedValue(new Error("nope"));
    const onClose = vi.fn();
    renderModal(onClose);

    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(mockSetMembers).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows an inline upgrade prompt linking to /pricing on a plan-limit error", () => {
    mockUseSetJobsiteMembers.mockReturnValue({
      setJobsiteMembers: mockSetMembers,
      isSaving: false,
      planLimitError: new PlanLimitError("Superintendent roles are part of GC Portfolio.", null),
    });
    renderModal();

    expect(screen.getByRole("alert").textContent).toContain(
      "Superintendent roles are part of GC Portfolio.",
    );
    expect(
      screen.getByRole("link", { name: /see plans/i }).getAttribute("href"),
    ).toBe("/pricing");
  });

  it("shows the Save button as busy while saving", () => {
    mockUseSetJobsiteMembers.mockReturnValue({
      setJobsiteMembers: mockSetMembers,
      isSaving: true,
      planLimitError: null,
    });
    renderModal();

    expect(
      screen.getByRole("button", { name: /^save$/i }).getAttribute("aria-busy"),
    ).toBe("true");
  });

  it("explains and disables checkboxes and Save while offline", () => {
    mockUseOnlineStatus.mockReturnValue({ isOnline: false });
    renderModal();

    expect(screen.getByRole("status").textContent).toMatch(/you're offline/i);
    expect((screen.getByLabelText("Ann") as HTMLInputElement).disabled).toBe(true);
    expect(
      (screen.getByRole("button", { name: /^save$/i }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
