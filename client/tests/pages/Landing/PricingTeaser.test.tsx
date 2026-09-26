import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "styled-components";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { PricingTeaser } from "../../../src/pages/Landing/PricingTeaser";
import theme from "../../../src/styles/theme";

describe("PricingTeaser", () => {
  it("renders the pricing preview heading and audience selector", () => {
    render(
      <MemoryRouter>
        <ThemeProvider theme={theme}>
          <PricingTeaser />
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText(/Pricing built around the jobsite/i)).toBeDefined();
    expect(
      screen.getByRole("button", { name: /for subcontractors/i }),
    ).toBeDefined();
    expect(
      screen.getByRole("button", { name: /for general contractors/i }),
    ).toBeDefined();
  });

  it("switches the visible plans when the audience changes", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <ThemeProvider theme={theme}>
          <PricingTeaser />
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText("Trade Free")).toBeDefined();
    expect(screen.queryByText("GC Free Portal")).toBeNull();

    await user.click(
      screen.getByRole("button", { name: /for general contractors/i }),
    );

    expect(screen.getByText("GC Free Portal")).toBeDefined();
    expect(screen.queryByText("Trade Free")).toBeNull();

    const link = screen.getByRole("link", { name: /See full plan details/i });
    expect(link.getAttribute("href")).toBe("/pricing?audience=gc");
  });

  it("tags unbuilt features with Coming soon and leaves built ones untagged", () => {
    render(
      <MemoryRouter>
        <ThemeProvider theme={theme}>
          <PricingTeaser />
        </ThemeProvider>
      </MemoryRouter>,
    );

    const unbuilt = screen.getByText("Custom safety manual upload");
    expect(within(unbuilt).getByText("Coming soon")).toBeDefined();

    const built = screen.getByText("Full offline PWA capabilities");
    expect(within(built).queryByText("Coming soon")).toBeNull();
  });
});
