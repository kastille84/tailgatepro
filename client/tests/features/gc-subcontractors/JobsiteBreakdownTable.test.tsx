import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { JobsiteBreakdownTable } from "../../../src/features/gc-subcontractors/JobsiteBreakdownTable";
import theme from "../../../src/styles/theme";
import type { GcSubJobsiteBreakdown } from "../../../src/interfaces/gcSubcontractors";

const jobsites: GcSubJobsiteBreakdown[] = [
  { jobsiteId: "jobsite-1", jobsiteName: "Downtown Tower", cadence: "daily", expectedPeriods: 30, loggedPeriods: 26, score: 87 },
  { jobsiteId: "jobsite-2", jobsiteName: "North Site", cadence: "weekly", expectedPeriods: 10, loggedPeriods: 1, score: 10 },
];

describe("JobsiteBreakdownTable", () => {
  it("renders one row per jobsite with its logged/expected days and score", () => {
    render(
      <ThemeProvider theme={theme}>
        <JobsiteBreakdownTable jobsites={jobsites} />
      </ThemeProvider>,
    );

    expect(screen.getByText("Downtown Tower")).toBeDefined();
    expect(screen.getByText("Logged 26 of 30 expected days")).toBeDefined();
    expect(screen.getByText("87%")).toBeDefined();

    expect(screen.getByText("North Site")).toBeDefined();
    expect(screen.getByText("Logged 1 of 10 expected weeks")).toBeDefined();
    expect(screen.getByText("10%")).toBeDefined();
  });
});
