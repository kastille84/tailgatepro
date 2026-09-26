import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { MemoryRouter } from "react-router-dom";

import { JobsiteRosterModal } from "../../../src/features/jobsites/JobsiteRosterModal";
import theme from "../../../src/styles/theme";
import type { Jobsite } from "../../../src/interfaces/jobsite";

const mockUseOnlineStatus = vi.fn();
const mockRemove = vi.fn();

vi.mock("../../../src/context/online-status", () => ({
  useOnlineStatus: () => mockUseOnlineStatus(),
}));
vi.mock("../../../src/hooks/useRemoveSubcontractor", () => ({
  useRemoveSubcontractor: () => ({
    removeSubcontractor: mockRemove,
    isRemoving: false,
  }),
}));
vi.mock("../../../src/features/jobsites/InviteSubcontractorForm", () => ({
  InviteSubcontractorForm: ({ jobsiteId }: { jobsiteId: string }) => (
    <div data-testid="invite-form">{jobsiteId}</div>
  ),
}));

const jobsite: Jobsite = {
  id: "j1",
  gcCompanyId: "gc-1",
  name: "Riverside",
  status: "active",
  archivedAt: null,
  createdBySub: false,
  createdAt: "x",
  subcontractors: [
    {
      id: "s1",
      email: "jane@acme.com",
      status: "accepted",
      companyName: "Acme Roofing",
      locked: false,
    },
    { id: "s2", email: "bob@new.com", status: "pending", companyName: null, locked: false },
  ],
};

const renderModal = (
  props: Partial<React.ComponentProps<typeof JobsiteRosterModal>> = {},
) =>
  render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <JobsiteRosterModal
          jobsite={jobsite}
          canManage
          onClose={vi.fn()}
          {...props}
        />
      </ThemeProvider>
    </MemoryRouter>,
  );

describe("JobsiteRosterModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOnlineStatus.mockReturnValue({ isOnline: true });
    mockRemove.mockResolvedValue(undefined);
  });

  it("lists accepted and pending subs with the right labels", () => {
    renderModal();

    expect(screen.getByText("Acme Roofing")).toBeDefined();
    expect(screen.getByText("jane@acme.com")).toBeDefined();
    expect(screen.getByText("Accepted")).toBeDefined();
    // A pending invite has no company yet, so the email is the heading.
    expect(screen.getByText("bob@new.com")).toBeDefined();
    expect(screen.getByText("Pending")).toBeDefined();
    expect(screen.getByTestId("invite-form").textContent).toBe("j1");
  });

  it("hides a locked sub's identity, offers an upgrade link, and still allows removal", async () => {
    renderModal({
      jobsite: {
        ...jobsite,
        subcontractors: [
          { id: "s9", email: null, status: "accepted", companyName: null, locked: true },
        ],
      },
    });

    expect(screen.getByText("Locked subcontractor")).toBeDefined();
    expect(
      screen.getByRole("link", { name: /upgrade to unlock/i }).getAttribute("href"),
    ).toBe("/pricing");

    fireEvent.click(screen.getByRole("button", { name: "Remove Locked subcontractor" }));
    expect(screen.getByText("Locked subcontractor", { selector: "strong" })).toBeDefined();
    const confirm = screen.getAllByRole("button", { name: /^remove$/i });
    fireEvent.click(confirm[confirm.length - 1]);

    await waitFor(() =>
      expect(mockRemove).toHaveBeenCalledWith({ jobsiteId: "j1", subId: "s9" }),
    );
  });

  it("shows an empty message when nobody is invited", () => {
    renderModal({ jobsite: { ...jobsite, subcontractors: [] } });
    expect(screen.getByText(/no subcontractors invited yet/i)).toBeDefined();
  });

  it("hides invite and remove controls when the caller cannot manage", () => {
    renderModal({ canManage: false });

    expect(screen.queryByTestId("invite-form")).toBeNull();
    expect(screen.queryByRole("button", { name: /remove|cancel invite/i })).toBeNull();
    expect(screen.getByText("Acme Roofing")).toBeDefined();
  });

  it("confirms, then removes an accepted sub", async () => {
    renderModal();

    fireEvent.click(
      screen.getByRole("button", { name: "Remove jane@acme.com" }),
    );
    expect(screen.getByText(/lose dashboard access/i)).toBeDefined();

    const confirm = screen.getAllByRole("button", { name: /^remove$/i });
    fireEvent.click(confirm[confirm.length - 1]);

    await waitFor(() =>
      expect(mockRemove).toHaveBeenCalledWith({ jobsiteId: "j1", subId: "s1" }),
    );
    await waitFor(() =>
      expect(screen.queryByText(/lose dashboard access/i)).toBeNull(),
    );
  });

  it("falls back to the email in the removal prompt when an accepted sub has no company name", () => {
    renderModal({
      jobsite: {
        ...jobsite,
        subcontractors: [
          { id: "s3", email: "solo@x.com", status: "accepted", companyName: null, locked: false },
        ],
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Remove solo@x.com" }));
    expect(screen.getByText("solo@x.com", { selector: "strong" })).toBeDefined();
  });

  it("confirms, then cancels a pending invite", async () => {
    renderModal();

    fireEvent.click(
      screen.getByRole("button", { name: "Cancel invite for bob@new.com" }),
    );
    expect(screen.getByText(/link in their email will stop working/i)).toBeDefined();

    const confirm = screen.getAllByRole("button", { name: /^cancel invite$/i });
    fireEvent.click(confirm[confirm.length - 1]);

    await waitFor(() =>
      expect(mockRemove).toHaveBeenCalledWith({ jobsiteId: "j1", subId: "s2" }),
    );
  });

  it("closes the confirm dialog after a failed removal", async () => {
    mockRemove.mockRejectedValue(new Error("nope"));
    renderModal();

    fireEvent.click(
      screen.getByRole("button", { name: "Remove jane@acme.com" }),
    );
    const confirm = screen.getAllByRole("button", { name: /^remove$/i });
    fireEvent.click(confirm[confirm.length - 1]);

    await waitFor(() => expect(mockRemove).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.queryByText(/lose dashboard access/i)).toBeNull(),
    );
  });

  it("dismisses the confirm dialog without removing", () => {
    renderModal();

    fireEvent.click(
      screen.getByRole("button", { name: "Remove jane@acme.com" }),
    );
    const cancels = screen.getAllByRole("button", { name: /^cancel$/i });
    fireEvent.click(cancels[cancels.length - 1]);

    expect(mockRemove).not.toHaveBeenCalled();
    expect(screen.queryByText(/lose dashboard access/i)).toBeNull();
  });

  it("explains and disables removal while offline", () => {
    mockUseOnlineStatus.mockReturnValue({ isOnline: false });
    renderModal();

    expect(screen.getByRole("status").textContent).toMatch(/you're offline/i);
    expect(
      (screen.getByRole("button", { name: "Remove jane@acme.com" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
