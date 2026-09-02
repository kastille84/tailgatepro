import React from "react";
import { render, screen } from "@testing-library/react";
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
});
