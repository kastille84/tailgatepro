import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { CompliancePdfCard } from "../../../src/pages/Landing/CompliancePdfCard";
import theme from "../../../src/styles/theme";

const renderCard = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe("CompliancePdfCard", () => {
  it("renders the default sample record", () => {
    renderCard(<CompliancePdfCard />);

    expect(
      screen.getByRole("img", {
        name: /example tailgatepro compliance pdf — a signed fall protection toolbox talk with 4 crew signatures/i,
      }),
    ).toBeTruthy();
    expect(screen.getByText("Fall Protection")).toBeTruthy();
    expect(screen.getByText("May 14, 2025")).toBeTruthy();
    expect(screen.getByText("P. Nowak")).toBeTruthy();
    expect(screen.getByText(/GPS-Verified/i)).toBeTruthy();
    expect(screen.getByText("Logged via TailgatePro")).toBeTruthy();
  });

  it("honours custom topic, date and crew props", () => {
    renderCard(
      <CompliancePdfCard
        topic="Trenching"
        date="Jan 2, 2026"
        crew={["A. Lee", "B. Cruz"]}
      />,
    );

    expect(
      screen.getByRole("img", {
        name: /a signed trenching toolbox talk with 2 crew signatures/i,
      }),
    ).toBeTruthy();
    expect(screen.getByText("Trenching")).toBeTruthy();
    expect(screen.getByText("Jan 2, 2026")).toBeTruthy();
    expect(screen.getByText("A. Lee")).toBeTruthy();
    expect(screen.getByText("B. Cruz")).toBeTruthy();
  });
});
