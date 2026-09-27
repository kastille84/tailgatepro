import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { ScoreBadge } from "../../../src/features/gc-subcontractors/ScoreBadge";
import theme from "../../../src/styles/theme";

const renderBadge = (score: number, size?: "sm" | "lg") =>
  render(
    <ThemeProvider theme={theme}>
      <ScoreBadge score={score} size={size} />
    </ThemeProvider>,
  );

describe("ScoreBadge", () => {
  it("renders the score as a percentage", () => {
    renderBadge(87);
    expect(screen.getByText("87%")).toBeDefined();
  });

  it("renders 0% and 100% at the tier boundaries without throwing", () => {
    renderBadge(0);
    expect(screen.getByText("0%")).toBeDefined();
  });

  it("defaults to the small badge and accepts a large size", () => {
    const { container: small } = renderBadge(90);
    const { container: large } = renderBadge(90, "lg");

    expect(small.textContent).toBe("90%");
    expect(large.textContent).toBe("90%");
  });
});
