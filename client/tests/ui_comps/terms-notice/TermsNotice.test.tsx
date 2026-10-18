import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { TermsNotice } from "../../../src/ui_comps/terms-notice";
import theme from "../../../src/styles/theme";

describe("TermsNotice", () => {
  it("links to the terms and privacy pages", () => {
    render(
      <ThemeProvider theme={theme}>
        <TermsNotice />
      </ThemeProvider>,
    );

    expect(
      screen.getByRole("link", { name: /terms & conditions/i }).getAttribute("href"),
    ).toBe("/terms");
    expect(
      screen.getByRole("link", { name: /privacy policy/i }).getAttribute("href"),
    ).toBe("/privacy");
  });
});
