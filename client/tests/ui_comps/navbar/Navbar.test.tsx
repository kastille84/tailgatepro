import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import Navbar from "../../../src/ui_comps/navbar/Navbar";
import theme from "../../../src/styles/theme";

describe("Navbar", () => {
  it("renders the brand and toggles the mobile menu state", () => {
    render(
      <MemoryRouter>
        <ThemeProvider theme={theme}>
          <Navbar />
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("navigation", { name: /main navigation/i }),
    ).toBeDefined();
    expect(screen.getByAltText(/tailgatepro/i)).toBeDefined();

    const toggle = screen.getByLabelText(/toggle menu/i);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  });
});
