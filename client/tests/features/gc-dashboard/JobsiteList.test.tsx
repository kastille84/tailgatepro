import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { JobsiteList } from "../../../src/features/gc-dashboard";
import theme from "../../../src/styles/theme";
import type { GcJobsite } from "../../../src/interfaces/gcDashboard";

const jobsites: GcJobsite[] = [
  {
    name: "Downtown Tower",
    subs: [
      {
        companyId: "sub-1",
        companyName: "Rivera Electric",
        projectId: "project-1",
        status: "logged",
        lastLoggedAt: "2026-09-21T13:00:00.000Z",
        count: 1,
      },
      {
        companyId: "sub-2",
        companyName: "Apex Plumbing",
        projectId: "project-2",
        status: "missing",
        lastLoggedAt: null,
        count: 0,
      },
    ],
  },
];

const renderList = (
  props: Partial<React.ComponentProps<typeof JobsiteList>> = {},
) =>
  render(
    <ThemeProvider theme={theme}>
      <JobsiteList jobsites={jobsites} onSelectSub={vi.fn()} {...props} />
    </ThemeProvider>,
  );

describe("JobsiteList", () => {
  it("renders an empty state when there are no linked jobsites", () => {
    renderList({ jobsites: [] });
    expect(screen.getByText(/no linked job sites yet/i)).toBeDefined();
  });

  it("renders a section per jobsite with each sub's row", () => {
    renderList();

    expect(screen.getByText("Downtown Tower")).toBeDefined();
    expect(screen.getByText("Rivera Electric")).toBeDefined();
    expect(screen.getByText("Apex Plumbing")).toBeDefined();
  });

  it("calls onSelectSub with the clicked sub", () => {
    const onSelectSub = vi.fn();
    renderList({ onSelectSub });

    fireEvent.click(screen.getByRole("button", { name: /apex plumbing/i }));
    expect(onSelectSub).toHaveBeenCalledWith(jobsites[0].subs[1]);
  });
});
