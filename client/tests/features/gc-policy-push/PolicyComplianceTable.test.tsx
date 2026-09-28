import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { PolicyComplianceTable } from "../../../src/features/gc-policy-push/PolicyComplianceTable";
import theme from "../../../src/styles/theme";
import type { PolicyPushJobsite } from "../../../src/interfaces/policyPush";

describe("PolicyComplianceTable", () => {
  it("shows an empty state when there are no active job sites", () => {
    render(
      <ThemeProvider theme={theme}>
        <PolicyComplianceTable jobsites={[]} />
      </ThemeProvider>,
    );

    expect(screen.getByText(/no active job sites/i)).toBeDefined();
  });

  it("renders each jobsite's roster with a Logged/Missing status pill per sub", () => {
    const jobsites: PolicyPushJobsite[] = [
      {
        id: "jobsite-1",
        name: "Downtown Tower",
        subs: [
          { companyId: "sub-1", companyName: "Rivera Electric", status: "logged", lastLoggedAt: "x" },
          { companyId: "sub-2", companyName: "Acme Roofing", status: "missing", lastLoggedAt: null },
        ],
      },
      {
        id: "jobsite-2",
        name: "North Site",
        subs: [
          { companyId: "sub-3", companyName: null, status: "missing", lastLoggedAt: null },
        ],
      },
    ];

    render(
      <ThemeProvider theme={theme}>
        <PolicyComplianceTable jobsites={jobsites} />
      </ThemeProvider>,
    );

    expect(screen.getByText("Downtown Tower")).toBeDefined();
    expect(screen.getByText("Rivera Electric")).toBeDefined();
    expect(screen.getByText("Acme Roofing")).toBeDefined();
    expect(screen.getByText("North Site")).toBeDefined();
    expect(screen.getByText("Unknown company")).toBeDefined();
    expect(screen.getAllByText("Logged")).toHaveLength(1);
    expect(screen.getAllByText("Missing")).toHaveLength(2);
  });
});
