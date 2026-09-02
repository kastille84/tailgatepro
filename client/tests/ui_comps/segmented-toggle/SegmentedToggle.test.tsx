import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { describe, expect, it, vi } from "vitest";

import { SegmentedToggle } from "../../../src/ui_comps/segmented-toggle";
import theme from "../../../src/styles/theme";

describe("SegmentedToggle", () => {
  it("renders the provided options and updates the selected one", () => {
    const onChange = vi.fn();

    render(
      <ThemeProvider theme={theme}>
        <SegmentedToggle
          options={[
            { value: "sub", label: "For subcontractors" },
            { value: "gc", label: "For general contractors" },
          ]}
          value="sub"
          onChange={onChange}
          ariaLabel="Choose your audience"
        />
      </ThemeProvider>,
    );

    const group = screen.getByRole("group", { name: /choose your audience/i });
    expect(group).toBeDefined();

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
    expect(buttons[0].getAttribute("aria-pressed")).toBe("true");
    expect(buttons[1].getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(buttons[1]);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("gc");
  });
});
