import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { MemoryRouter } from "react-router-dom";

import { JobsiteList } from "../../../src/features/gc-dashboard";
import theme from "../../../src/styles/theme";
import type { GcJobsite } from "../../../src/interfaces/gcDashboard";

const jobsites: GcJobsite[] = [
  {
    id: "jobsite-1",
    name: "Downtown Tower",
    createdBySub: false,
    subs: [
      {
        companyId: "sub-1",
        companyName: "Rivera Electric",
        projectId: "project-1",
        status: "logged",
        lastLoggedAt: "2026-09-21T13:00:00.000Z",
        count: 1,
        locked: false,
      },
      {
        companyId: "sub-2",
        companyName: "Apex Plumbing",
        projectId: "project-2",
        status: "missing",
        lastLoggedAt: null,
        count: 0,
        locked: false,
      },
    ],
  },
];

const renderList = (
  props: Partial<React.ComponentProps<typeof JobsiteList>> = {},
) =>
  render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <JobsiteList jobsites={jobsites} onSelectSub={vi.fn()} {...props} />
      </ThemeProvider>
    </MemoryRouter>,
  );

describe("JobsiteList", () => {
  it("shows a Created by subcontractor badge only for a sub-originated jobsite", () => {
    const { unmount } = renderList();
    expect(screen.queryByText("Created by subcontractor")).toBeNull();
    unmount();

    renderList({ jobsites: [{ ...jobsites[0], createdBySub: true }] });
    expect(screen.getByText("Created by subcontractor")).toBeDefined();
  });

  it("renders an empty state when there are no linked jobsites", () => {
    renderList({ jobsites: [] });
    expect(screen.getByText(/no linked job sites yet/i)).toBeDefined();
    expect(
      screen.getByRole("link", { name: /create a job site/i }).getAttribute("href"),
    ).toBe("/projects");
  });

  it("explains a jobsite with no subs and links to /projects to invite some", () => {
    renderList({ jobsites: [{ id: "jobsite-2", name: "Empty Site", createdBySub: false, subs: [] }] });

    expect(screen.getByText("Empty Site")).toBeDefined();
    expect(screen.getByText(/no subcontractors on this job site yet/i)).toBeDefined();
    expect(
      screen.getByRole("link", { name: /invite subcontractors/i }).getAttribute("href"),
    ).toBe("/projects");
  });

  it("renders a section per jobsite with each sub's row", () => {
    renderList();

    expect(screen.getByText("Downtown Tower")).toBeDefined();
    expect(screen.getByText("Rivera Electric")).toBeDefined();
    expect(screen.getByText("Apex Plumbing")).toBeDefined();
  });

  it("renders a locked sub as a placeholder with an upgrade link", () => {
    renderList({
      jobsites: [
        {
          id: "jobsite-3",
          name: "Locked Site",
          subs: [
            {
              companyId: null,
              companyName: null,
              projectId: null,
              status: null,
              lastLoggedAt: null,
              count: null,
              locked: true,
            },
            {
              companyId: null,
              companyName: null,
              projectId: null,
              status: null,
              lastLoggedAt: null,
              count: null,
              locked: true,
            },
          ],
        },
      ],
    });

    expect(screen.getAllByRole("link", { name: /unlock on site pro/i })).toHaveLength(2);
  });

  it("calls onSelectSub with the clicked sub", () => {
    const onSelectSub = vi.fn();
    renderList({ onSelectSub });

    fireEvent.click(screen.getByRole("button", { name: /apex plumbing/i }));
    expect(onSelectSub).toHaveBeenCalledWith(jobsites[0].subs[1]);
  });
});
