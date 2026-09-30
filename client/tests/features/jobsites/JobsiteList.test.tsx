import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { MemoryRouter } from "react-router-dom";

import { JobsiteList } from "../../../src/features/jobsites/JobsiteList";
import theme from "../../../src/styles/theme";
import type { Jobsite } from "../../../src/interfaces/jobsite";

const base: Jobsite = {
  id: "j1",
  gcCompanyId: "gc-1",
  name: "Riverside",
  status: "active",
  archivedAt: null,
  createdBySub: false,
  plan: "free",
  sitePro: false,
  createdAt: "x",
  subcontractors: [
    { id: "s1", email: "a@a.com", status: "accepted", companyName: "A Co" },
    { id: "s2", email: "b@b.com", status: "pending", companyName: null },
    { id: "s3", email: "c@c.com", status: "pending", companyName: null },
  ],
};

const renderList = (
  props: Partial<React.ComponentProps<typeof JobsiteList>> = {},
) =>
  render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <JobsiteList
          jobsites={[base]}
          onManageSubs={vi.fn()}
          onDownloadBundle={vi.fn()}
          isOnline
          {...props}
        />
      </ThemeProvider>
    </MemoryRouter>,
  );

describe("JobsiteList", () => {
  it("shows an empty state with no jobsites", () => {
    renderList({ jobsites: [] });
    expect(screen.getByText(/no job sites yet/i)).toBeDefined();
  });

  it("shows the name, status, and a roster summary", () => {
    renderList();

    expect(screen.getByText("Riverside")).toBeDefined();
    expect(screen.getByText("active")).toBeDefined();
    expect(screen.getByText("1 subcontractor, 2 pending")).toBeDefined();
  });

  it("pluralizes the subcontractor count", () => {
    renderList({ jobsites: [{ ...base, subcontractors: [] }] });
    expect(screen.getByText("0 subcontractors, 0 pending")).toBeDefined();
  });

  it("shows an Archived badge instead of the status for an archived jobsite", () => {
    renderList({ jobsites: [{ ...base, archivedAt: "2026-09-02" }] });

    expect(screen.getByText("Archived")).toBeDefined();
    expect(screen.queryByText("active")).toBeNull();
  });

  it("shows a Created by subcontractor badge only for a sub-originated jobsite", () => {
    const { unmount } = renderList();
    expect(screen.queryByText("Created by subcontractor")).toBeNull();
    unmount();

    renderList({ jobsites: [{ ...base, createdBySub: true }] });
    expect(screen.getByText("Created by subcontractor")).toBeDefined();
  });

  it("reports Subs and Edit clicks with the jobsite", () => {
    const onManageSubs = vi.fn();
    const onEdit = vi.fn();
    renderList({ onManageSubs, onEdit });

    fireEvent.click(
      screen.getByRole("button", { name: "Subcontractors for Riverside" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit Riverside" }));

    expect(onManageSubs).toHaveBeenCalledWith(base);
    expect(onEdit).toHaveBeenCalledWith(base);
  });

  it("omits Edit when no onEdit is provided", () => {
    renderList();
    expect(screen.queryByRole("button", { name: /^edit/i })).toBeNull();
  });

  it("omits Team when no onManageMembers is provided", () => {
    renderList();
    expect(
      screen.queryByRole("button", { name: /^superintendents/i }),
    ).toBeNull();
  });

  it("reports a Team click with the jobsite when onManageMembers is provided", () => {
    const onManageMembers = vi.fn();
    renderList({ onManageMembers });

    fireEvent.click(
      screen.getByRole("button", { name: "Superintendents for Riverside" }),
    );

    expect(onManageMembers).toHaveBeenCalledWith(base);
  });

  it("shows a disabled Defense Bundle button on a non-Site-Pro jobsite", () => {
    renderList({ jobsites: [{ ...base, plan: "free" }] });

    expect(
      (
        screen.getByRole("button", {
          name: "Download OSHA Defense Bundle for Riverside",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.queryByRole("link", { name: /defense bundle/i })).toBeNull();
  });

  it("offers Upgrade to Site Pro on an active free jobsite when onUpgrade is provided", () => {
    const onUpgrade = vi.fn();
    renderList({ jobsites: [{ ...base, plan: "free" }], onUpgrade });

    expect(
      screen.queryByRole("button", { name: "Download OSHA Defense Bundle for Riverside" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Upgrade Riverside to Site Pro" }));

    expect(onUpgrade).toHaveBeenCalledWith({ ...base, plan: "free" });
  });

  it("disables Upgrade to Site Pro while offline", () => {
    renderList({ onUpgrade: vi.fn(), isOnline: false });

    expect(
      (screen.getByRole("button", { name: "Upgrade Riverside to Site Pro" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("does not offer an upgrade on an archived or completed jobsite", () => {
    const onUpgrade = vi.fn();
    const { unmount } = renderList({
      jobsites: [{ ...base, archivedAt: "2026-09-02" }],
      onUpgrade,
    });
    expect(screen.queryByRole("button", { name: /to site pro/i })).toBeNull();
    unmount();

    renderList({ jobsites: [{ ...base, status: "completed" }], onUpgrade });
    expect(screen.queryByRole("button", { name: /to site pro/i })).toBeNull();
  });

  it("does not offer an upgrade on a jobsite that is already Site Pro", () => {
    renderList({ jobsites: [{ ...base, plan: "site_pro", sitePro: true }], onUpgrade: vi.fn() });

    expect(screen.queryByRole("button", { name: /to site pro/i })).toBeNull();
  });

  it("treats a free-plan jobsite under GC Portfolio as Site Pro and says it is covered", () => {
    const onDownloadBundle = vi.fn();
    renderList({
      jobsites: [{ ...base, plan: "free", sitePro: true }],
      onUpgrade: vi.fn(),
      onDownloadBundle,
    });

    expect(screen.getByText("Covered by GC Portfolio")).toBeDefined();
    expect(screen.queryByRole("button", { name: /to site pro/i })).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Download OSHA Defense Bundle for Riverside" }),
    );
    expect(onDownloadBundle).toHaveBeenCalled();
  });

  it("does not show the covered badge on a jobsite that pays for its own Site Pro", () => {
    renderList({ jobsites: [{ ...base, plan: "site_pro", sitePro: true }] });

    expect(screen.queryByText("Covered by GC Portfolio")).toBeNull();
  });

  it("reports a Defense Bundle click with the jobsite on a Site Pro jobsite", () => {
    const onDownloadBundle = vi.fn();
    renderList({ jobsites: [{ ...base, plan: "site_pro", sitePro: true }], onDownloadBundle });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Download OSHA Defense Bundle for Riverside",
      }),
    );

    expect(onDownloadBundle).toHaveBeenCalledWith({
      ...base,
      plan: "site_pro",
      sitePro: true,
    });
  });

  it("disables the Defense Bundle button while offline", () => {
    renderList({ jobsites: [{ ...base, plan: "site_pro", sitePro: true }], isOnline: false });

    expect(
      (
        screen.getByRole("button", {
          name: "Download OSHA Defense Bundle for Riverside",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("disables the Defense Bundle button while a download is in flight", () => {
    renderList({
      jobsites: [{ ...base, plan: "site_pro", sitePro: true }],
      isDownloadingBundle: true,
    });

    expect(
      (
        screen.getByRole("button", {
          name: "Download OSHA Defense Bundle for Riverside",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
