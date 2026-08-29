import React from "react";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { describe, expect, it } from "vitest";

import { Button } from "../../../src/ui_comps/button";
import theme from "../../../src/styles/theme";

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe("Button", () => {
  it("renders its default content and default button type", () => {
    renderWithTheme(<Button>Join waitlist</Button>);

    const button = screen.getByRole("button", { name: /join waitlist/i });
    expect(button).toBeDefined();
    expect(button.getAttribute("type")).toBe("button");
    expect(button.getAttribute("aria-busy")).toBeNull();
  });

  it("renders left and right icons when not loading", () => {
    renderWithTheme(
      <Button leftIcon={<span>left</span>} rightIcon={<span>right</span>}>
        Continue
      </Button>,
    );

    expect(screen.getByText("left")).toBeDefined();
    expect(screen.getByText("right")).toBeDefined();
    expect(screen.queryByLabelText(/spinner/i)).toBeNull();
  });

  it("shows the loading spinner, disables the button, and hides icons", () => {
    renderWithTheme(
      <Button loading leftIcon={<span>left</span>} rightIcon={<span>right</span>}>
        Processing
      </Button>,
    );

    const button = screen.getByRole("button", { name: /processing/i });
    expect(button).toBeDefined();
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.disabled).toBe(true);
    expect(screen.queryByText("left")).toBeNull();
    expect(screen.queryByText("right")).toBeNull();
    expect(button.querySelector("svg")).not.toBeNull();
  });

  it("supports full-width and custom variants/sizes", () => {
    renderWithTheme(
      <Button variant="outline" size="lg" fullWidth type="submit">
        Submit
      </Button>,
    );

    const button = screen.getByRole("button", { name: /submit/i });
    expect(button.getAttribute("type")).toBe("submit");
    expect(button).toBeDefined();
  });
});
