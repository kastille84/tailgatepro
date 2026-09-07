import React from "react";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { describe, expect, it } from "vitest";

import { Footer } from "../../../src/ui_comps/footer/Footer";
import theme from "../../../src/styles/theme";

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe("Footer", () => {
  it("renders the brand mark and default standalone footer copy", () => {
    renderWithTheme(<Footer />);

    expect(screen.getByText("TAILGATE")).toBeDefined();
    expect(screen.getByText("PRO")).toBeDefined();
    expect(screen.getByText(/Digital Toolbox Safety Talks/i)).toBeDefined();
    expect(
      screen.getByText(
        new RegExp(`© ${new Date().getFullYear()} TailgatePro`, "i"),
      ),
    ).toBeDefined();
  });

  it("accepts custom year and text overrides", () => {
    renderWithTheme(
      <Footer year={2024} text="Safety from the field to the GC" />,
    );

    expect(screen.getByText(/Safety from the field to the GC/i)).toBeDefined();
    expect(screen.getByText(/© 2024 TailgatePro/i)).toBeDefined();
  });
});
