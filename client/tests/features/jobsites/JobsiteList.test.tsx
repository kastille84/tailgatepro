import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

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
    <ThemeProvider theme={theme}>
      <JobsiteList jobsites={[base]} onManageSubs={vi.fn()} {...props} />
    </ThemeProvider>,
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
});
