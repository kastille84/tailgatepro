import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { MemoryRouter } from "react-router-dom";

import { PolicyPushUpgradeNotice } from "../../../src/features/gc-policy-push/PolicyPushUpgradeNotice";
import theme from "../../../src/styles/theme";

describe("PolicyPushUpgradeNotice", () => {
  it("explains the Portfolio-only gate and links to /pricing", () => {
    render(
      <MemoryRouter>
        <ThemeProvider theme={theme}>
          <PolicyPushUpgradeNotice />
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText(/gc portfolio feature/i)).toBeDefined();
    expect(
      screen.getByRole("link", { name: /upgrade to gc portfolio/i }).getAttribute("href"),
    ).toBe("/pricing");
  });
});
