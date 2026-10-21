import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { StatTiles } from "../../../src/features/gc-dashboard";
import theme from "../../../src/styles/theme";

const renderTiles = (totals = { subs: 4, logged: 3, missing: 1, off: 0 }) =>
  render(
    <ThemeProvider theme={theme}>
      <StatTiles totals={totals} />
    </ThemeProvider>,
  );

describe("StatTiles", () => {
  it("renders the three headline numbers with their labels", () => {
    renderTiles();

    expect(screen.getByText("4")).toBeDefined();
    expect(screen.getByText("subs on site")).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();
    expect(screen.getByText("logged")).toBeDefined();
    expect(screen.getByText("1")).toBeDefined();
    expect(screen.getByText("missing")).toBeDefined();
    expect(screen.queryByText("day off")).toBeNull();
  });

  it("adds a day-off tile only when someone has the day off", () => {
    renderTiles({ subs: 4, logged: 2, missing: 1, off: 1 });

    expect(screen.getByText("day off")).toBeDefined();
  });
});
