import React from "react";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { describe, expect, it } from "vitest";

import { Input } from "../../../src/ui_comps/form";
import theme from "../../../src/styles/theme";

describe("Input", () => {
  it("renders an accessible input with the expected placeholder", () => {
    render(
      <ThemeProvider theme={theme}>
        <Input aria-label="Work email" placeholder="you@company.com" />
      </ThemeProvider>,
    );

    const input = screen.getByLabelText(/work email/i);
    expect(input).toBeDefined();
    expect(input.getAttribute("placeholder")).toBe("you@company.com");
    expect(input.getAttribute("aria-invalid")).toBe("false");
  });

  it("marks the control invalid when the hasError prop is set", () => {
    render(
      <ThemeProvider theme={theme}>
        <Input aria-label="Company" hasError />
      </ThemeProvider>,
    );

    const input = screen.getByLabelText(/company/i);
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });
});
