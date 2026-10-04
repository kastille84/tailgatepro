import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { MemoryRouter } from "react-router-dom";

import { SubScorecardList } from "../../../src/features/gc-subcontractors/SubScorecardList";
import theme from "../../../src/styles/theme";
import type { GcSubScorecardSummary } from "../../../src/interfaces/gcSubcontractors";

const scorecards: GcSubScorecardSummary[] = [
  { companyId: "sub-1", companyName: "Rivera Electric", overallScore: 40 },
  { companyId: "sub-2", companyName: "Apex Plumbing", overallScore: 95 },
];

const renderList = (list: GcSubScorecardSummary[]) =>
  render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <SubScorecardList scorecards={list} />
      </ThemeProvider>
    </MemoryRouter>,
  );

describe("SubScorecardList", () => {
  it("renders one row per sub", () => {
    renderList(scorecards);

    expect(screen.getByText("Rivera Electric")).toBeDefined();
    expect(screen.getByText("Apex Plumbing")).toBeDefined();
  });

  it("renders an empty state when the portfolio has no subs", () => {
    renderList([]);

    expect(screen.getByText(/no subcontractors on your portfolio yet/i)).toBeDefined();
  });
});
