import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { describe, expect, it, vi } from "vitest";

import { RadioGroup } from "../../../src/ui_comps/radio";
import theme from "../../../src/styles/theme";

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

const options = [
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
];

describe("RadioGroup", () => {
  it("renders a radiogroup with one option checked for the current value", () => {
    renderWithTheme(
      <RadioGroup
        name="status"
        options={options}
        value="active"
        onChange={() => {}}
        ariaLabel="Project status"
      />,
    );

    expect(
      screen.getByRole("radiogroup", { name: /project status/i }),
    ).toBeDefined();

    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(radios).toHaveLength(2);
    expect(radios[0].checked).toBe(true);
    expect(radios[1].checked).toBe(false);
  });

  it("reports the picked value", () => {
    const onChange = vi.fn();
    renderWithTheme(
      <RadioGroup
        name="status"
        options={options}
        value="active"
        onChange={onChange}
        ariaLabel="Project status"
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: /completed/i }));
    expect(onChange).toHaveBeenCalledWith("completed");
  });

  it("disables every option when the group is disabled and flags errors", () => {
    renderWithTheme(
      <RadioGroup
        name="status"
        options={options}
        value={null}
        onChange={() => {}}
        ariaLabel="Project status"
        disabled
        hasError
      />,
    );

    const group = screen.getByRole("radiogroup");
    expect(group.getAttribute("aria-invalid")).toBe("true");

    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(radios.every((radio) => radio.disabled)).toBe(true);
    expect(radios.some((radio) => radio.checked)).toBe(false);
  });

  it("honours a per-option disabled flag", () => {
    renderWithTheme(
      <RadioGroup
        name="status"
        options={[options[0], { ...options[1], disabled: true }]}
        value="active"
        onChange={() => {}}
        ariaLabel="Project status"
      />,
    );

    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(radios[0].disabled).toBe(false);
    expect(radios[1].disabled).toBe(true);
  });
});
