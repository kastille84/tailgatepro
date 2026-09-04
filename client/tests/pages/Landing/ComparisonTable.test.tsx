import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { ComparisonTable } from "../../../src/pages/Landing/ComparisonTable";
import theme from "../../../src/styles/theme";

const renderTable = () =>
  render(
    <ThemeProvider theme={theme}>
      <ComparisonTable />
    </ThemeProvider>,
  );

describe("ComparisonTable", () => {
  it("renders a captioned table with a header row", () => {
    renderTable();

    const table = screen.getByRole("table", {
      name: /feature comparison of tailgatepro versus legacy/i,
    });
    expect(table).toBeTruthy();

    expect(
      within(table).getByRole("columnheader", { name: "Legacy safety apps" }),
    ).toBeTruthy();
  });

  it("renders one row per feature with a value in each column", () => {
    renderTable();

    expect(screen.getByText("Getting started")).toBeTruthy();
    expect(screen.getByText("Languages")).toBeTruthy();
    expect(
      screen.getByText("Open a URL or scan a QR code — nothing to install"),
    ).toBeTruthy();
    expect(
      screen.getByText("Native App Store download on every phone"),
    ).toBeTruthy();

    // 9 feature rows + 1 header row
    expect(screen.getAllByRole("row")).toHaveLength(10);
  });
});
