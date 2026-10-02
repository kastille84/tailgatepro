import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { MemoryRouter } from "react-router-dom";

import { JobsiteList } from "../../../src/features/gc-dashboard";
import theme from "../../../src/styles/theme";
import type { GcJobsite } from "../../../src/interfaces/gcDashboard";

vi.mock("../../../src/context/online-status", () => ({
  useOnlineStatus: () => ({ isOnline: true }),
}));
vi.mock("../../../src/features/jobsites/SiteProCheckoutModal", () => ({
  SiteProCheckoutModal: ({
    jobsite,
    onClose,
  }: {
    jobsite: { id: string; name: string } | null;
    onClose: () => void;
  }) =>
    jobsite ? (
      <div data-testid="site-pro-modal">
        {jobsite.id}
        <button type="button" onClick={onClose}>
          stub-site-pro-close
        </button>
      </div>
    ) : null,
}));

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

  it("opens the sub-blur upsell with the site name and sub count from a locked row", () => {
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

    const unlockButtons = screen.getAllByRole("button", { name: /unlock on site pro/i });
    expect(unlockButtons).toHaveLength(2);

    fireEvent.click(unlockButtons[0]);
    expect(
      screen.getByText(/2 Subcontractors are actively logging safety talks on Locked Site/),
    ).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("starts the Site Pro purchase for that jobsite from the sub-blur upsell", () => {
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
          ],
        },
      ],
    });

    expect(screen.queryByTestId("site-pro-modal")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /unlock on site pro/i }));
    fireEvent.click(screen.getByRole("button", { name: "Upgrade to GC Site Pro" }));

    expect(screen.getByTestId("site-pro-modal").textContent).toContain("jobsite-3");
    expect(screen.queryByText(/actively logging safety talks/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "stub-site-pro-close" }));
    expect(screen.queryByTestId("site-pro-modal")).toBeNull();
  });

  it("calls onSelectSub with the clicked sub", () => {
    const onSelectSub = vi.fn();
    renderList({ onSelectSub });

    fireEvent.click(screen.getByRole("button", { name: /apex plumbing/i }));
    expect(onSelectSub).toHaveBeenCalledWith(jobsites[0].subs[1]);
  });
});
