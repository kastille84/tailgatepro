import React from "react";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { describe, expect, it } from "vitest";

import { Spinner } from "../../../src/ui_comps/spinner";
import theme from "../../../src/styles/theme";

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe("Spinner", () => {
  it("exposes an accessible status role with a default label", () => {
    renderWithTheme(<Spinner />);

    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-label")).toBe("Loading…");
    expect(status.getAttribute("aria-live")).toBe("polite");
  });

  it("uses a custom label when provided", () => {
    renderWithTheme(<Spinner label="Saving project" />);

    expect(
      screen.getByRole("status", { name: /saving project/i }),
    ).toBeDefined();
  });

  it("wraps the spinner in a centered block when center is set", () => {
    const { container } = renderWithTheme(<Spinner center />);

    const status = screen.getByRole("status");
    // the centering wrapper is the status node's parent
    expect(status.parentElement).not.toBe(container);
    expect(status.parentElement?.tagName).toBe("SPAN");
  });

  it("forwards extra props such as className to the spinner element", () => {
    renderWithTheme(<Spinner className="inline-spinner" />);

    expect(screen.getByRole("status").classList.contains("inline-spinner")).toBe(
      true,
    );
  });
});
