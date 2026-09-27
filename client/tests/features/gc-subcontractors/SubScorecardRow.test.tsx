import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { MemoryRouter } from "react-router-dom";

import { SubScorecardRow } from "../../../src/features/gc-subcontractors/SubScorecardRow";
import theme from "../../../src/styles/theme";
import type { GcSubScorecardSummary } from "../../../src/interfaces/gcSubcontractors";

const scorecard: GcSubScorecardSummary = {
  companyId: "sub-1",
  companyName: "Rivera Electric",
  overallScore: 87,
};

const renderRow = (overrides: Partial<GcSubScorecardSummary> = {}) =>
  render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <ul>
          <SubScorecardRow scorecard={{ ...scorecard, ...overrides }} />
        </ul>
      </ThemeProvider>
    </MemoryRouter>,
  );

describe("SubScorecardRow", () => {
  it("renders the sub's name, score and a drill-in link to its detail page", () => {
    renderRow();

    expect(screen.getByText("Rivera Electric")).toBeDefined();
    expect(screen.getByText("87%")).toBeDefined();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/gc/subcontractors/sub-1");
  });

  it("falls back to a placeholder name when companyName is null", () => {
    renderRow({ companyName: null });

    expect(screen.getByText("Unknown company")).toBeDefined();
  });
});
