import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { GcDashboardMockup } from "../../../src/pages/Landing/GcDashboardMockup";
import theme from "../../../src/styles/theme";

const renderMockup = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe("GcDashboardMockup", () => {
  it("renders the default (light) dashboard sample", () => {
    renderMockup(<GcDashboardMockup />);

    expect(
      screen.getByRole("img", {
        name: /example general-contractor dashboard/i,
      }),
    ).toBeTruthy();
    expect(
      screen.getByText("Downtown Tower — site compliance"),
    ).toBeTruthy();
    expect(screen.getByText("talks today")).toBeTruthy();
    expect(screen.getByText(/BuildRight Framing — Missing/)).toBeTruthy();
    expect(screen.getByText("Upgrade to unlock")).toBeTruthy();
  });

  it("renders with the dark tone", () => {
    renderMockup(<GcDashboardMockup tone="dark" />);

    expect(
      screen.getByRole("img", {
        name: /example general-contractor dashboard/i,
      }),
    ).toBeTruthy();
    expect(screen.getByText("Upgrade to unlock")).toBeTruthy();
  });
});
