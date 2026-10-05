import React from "react";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { describe, expect, it } from "vitest";

import { Terms, Privacy } from "../../../src/pages/Legal";
import theme from "../../../src/styles/theme";

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe("Terms", () => {
  it("renders the title, SMS program terms, and a link to the privacy policy", () => {
    renderWithTheme(<Terms />);

    expect(
      screen.getByRole("heading", { level: 1, name: /terms & conditions/i }),
    ).toBeDefined();
    expect(
      screen.getByRole("heading", { name: /text message \(sms\) program terms/i }),
    ).toBeDefined();
    expect(
      screen.getByText(/Edwin Edgardo Martinez, doing business as TailgatePro/),
    ).toBeDefined();
    expect(screen.getAllByText(/reply stop/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/message and data rates may apply/i).length).toBeGreaterThan(0);
    expect(
      screen
        .getAllByRole("link", { name: /privacy policy/i })
        .every((link) => link.getAttribute("href") === "/privacy"),
    ).toBe(true);
  });
});

describe("Privacy", () => {
  it("renders the title and the no-sharing SMS statement", () => {
    renderWithTheme(<Privacy />);

    expect(
      screen.getByRole("heading", { level: 1, name: /privacy policy/i }),
    ).toBeDefined();
    expect(
      screen.getByText(/do not sell, rent, or share mobile phone numbers/i),
    ).toBeDefined();
    expect(
      screen
        .getAllByRole("link", { name: /terms & conditions/i })
        .map((link) => link.getAttribute("href")),
    ).toContain("/terms#sms");
  });
});
