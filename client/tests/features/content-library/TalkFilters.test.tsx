import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { TalkFilters } from "../../../src/features/content-library/TalkFilters";
import theme from "../../../src/styles/theme";

const tradeFilterOptions = [
  { value: "all", label: "All trades" },
  { value: "Masonry", label: "Masonry" },
];

const renderFilters = (
  props: Partial<React.ComponentProps<typeof TalkFilters>> = {},
) =>
  render(
    <ThemeProvider theme={theme}>
      <TalkFilters
        trade="all"
        onTradeChange={vi.fn()}
        tradeFilterOptions={tradeFilterOptions}
        search=""
        onSearchChange={vi.fn()}
        favoritesOnly={false}
        onFavoritesOnlyChange={vi.fn()}
        customOnly={false}
        onCustomOnlyChange={vi.fn()}
        {...props}
      />
    </ThemeProvider>,
  );

describe("TalkFilters", () => {
  it("calls onTradeChange with the selected trade", () => {
    const onTradeChange = vi.fn();
    renderFilters({ onTradeChange });

    fireEvent.change(screen.getByLabelText(/^trade$/i), {
      target: { value: "Masonry" },
    });

    expect(onTradeChange).toHaveBeenCalledWith("Masonry");
  });

  it("calls onSearchChange with the typed search text", () => {
    const onSearchChange = vi.fn();
    renderFilters({ onSearchChange });

    fireEvent.change(screen.getByLabelText(/^search$/i), {
      target: { value: "silica" },
    });

    expect(onSearchChange).toHaveBeenCalledWith("silica");
  });

  it("calls onFavoritesOnlyChange with the checkbox's next checked state", () => {
    const onFavoritesOnlyChange = vi.fn();
    renderFilters({ onFavoritesOnlyChange });

    fireEvent.click(screen.getByLabelText(/favorites only/i));

    expect(onFavoritesOnlyChange).toHaveBeenCalledWith(true);
  });

  it("calls onCustomOnlyChange with the checkbox's next checked state", () => {
    const onCustomOnlyChange = vi.fn();
    renderFilters({ onCustomOnlyChange });

    fireEvent.click(screen.getByLabelText(/custom talks only/i));

    expect(onCustomOnlyChange).toHaveBeenCalledWith(true);
  });

  it("reflects the current trade/search/checkbox values", () => {
    renderFilters({
      trade: "Masonry",
      search: "silica",
      favoritesOnly: true,
      customOnly: true,
    });

    expect(
      (screen.getByLabelText(/^trade$/i) as HTMLSelectElement).value,
    ).toBe("Masonry");
    expect(
      (screen.getByLabelText(/^search$/i) as HTMLInputElement).value,
    ).toBe("silica");
    expect(
      (screen.getByLabelText(/favorites only/i) as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      (screen.getByLabelText(/custom talks only/i) as HTMLInputElement)
        .checked,
    ).toBe(true);
  });
});
