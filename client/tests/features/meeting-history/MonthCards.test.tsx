import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { MonthCards } from "../../../src/features/meeting-history/MonthCards";
import theme from "../../../src/styles/theme";

const renderCards = (
  months: { month: string; count: number }[],
  onSelect = vi.fn(),
) => {
  render(
    <ThemeProvider theme={theme}>
      <MonthCards months={months} onSelect={onSelect} />
    </ThemeProvider>,
  );
  return onSelect;
};

describe("MonthCards", () => {
  it("shows an empty state when there are no months", () => {
    renderCards([]);
    expect(screen.getByText("No completed meetings yet.")).toBeDefined();
  });

  it("renders one card per month with its talk count", () => {
    renderCards([
      { month: "2026-09", count: 23 },
      { month: "2026-08", count: 1 },
    ]);
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.getByText("23 talks")).toBeDefined();
    expect(screen.getByText("1 talk")).toBeDefined();
  });

  it("reports the month when a card is clicked", () => {
    const onSelect = renderCards([{ month: "2026-09", count: 3 }]);
    fireEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith("2026-09");
  });
});
