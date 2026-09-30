import React from "react";
import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { MemoryRouter } from "react-router-dom";

import { SubScorecardUpgradeNotice } from "../../../src/features/gc-subcontractors/SubScorecardUpgradeNotice";
import theme from "../../../src/styles/theme";

describe("SubScorecardUpgradeNotice", () => {
  it("explains the Portfolio-only gate and links to /pricing", () => {
    render(
      <MemoryRouter>
        <ThemeProvider theme={theme}>
          <SubScorecardUpgradeNotice />
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText(/gc portfolio feature/i)).toBeDefined();
    expect(
      screen.getByRole("link", { name: /upgrade to gc portfolio/i }).getAttribute("href"),
    ).toBe("/pricing");
  });

  it("opens the scorecard upsell modal from the unlock button", () => {
    render(
      <MemoryRouter>
        <ThemeProvider theme={theme}>
          <SubScorecardUpgradeNotice />
        </ThemeProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Unlock scorecards" }));
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText(/cross-project subcontractor safety scorecards/i)).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
