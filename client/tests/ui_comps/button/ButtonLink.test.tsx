import React from "react";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { ButtonLink } from "../../../src/ui_comps/button";
import theme from "../../../src/styles/theme";

const renderWithProviders = (ui: React.ReactElement) =>
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>{ui}</MemoryRouter>
    </ThemeProvider>,
  );

describe("ButtonLink", () => {
  it("renders a router link when given `to`", () => {
    renderWithProviders(<ButtonLink to="/signup">Start free</ButtonLink>);

    const link = screen.getByRole("link", { name: /start free/i });
    expect(link.getAttribute("href")).toBe("/signup");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders a plain anchor when given `href`", () => {
    renderWithProviders(
      <ButtonLink href="#for-gcs" variant="outline" size="lg" fullWidth>
        See the dashboard
      </ButtonLink>,
    );

    expect(
      screen.getByRole("link", { name: /see the dashboard/i }).getAttribute("href"),
    ).toBe("#for-gcs");
  });
});
