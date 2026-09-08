import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { describe, expect, it, vi } from "vitest";

import { Select } from "../../../src/ui_comps/select";
import theme from "../../../src/styles/theme";

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

const options = [
  { value: "gc", label: "General contractor" },
  { value: "subcontractor", label: "Subcontractor" },
];

describe("Select", () => {
  it("renders options from the options prop", () => {
    renderWithTheme(<Select aria-label="Company type" options={options} />);

    const select = screen.getByRole("combobox", { name: /company type/i });
    expect(select.querySelectorAll("option")).toHaveLength(2);
  });

  it("shows a disabled placeholder as the initial selection", () => {
    renderWithTheme(
      <Select
        aria-label="Company type"
        options={options}
        placeholder="Choose one…"
      />,
    );

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("");
    const placeholder = screen.getByRole("option", {
      name: /choose one…/i,
    }) as HTMLOptionElement;
    expect(placeholder.disabled).toBe(true);
  });

  it("prefers explicit children over the options prop", () => {
    renderWithTheme(
      <Select aria-label="Trade" options={options}>
        <option value="roofing">Roofing</option>
      </Select>,
    );

    const select = screen.getByRole("combobox");
    const rendered = Array.from(select.querySelectorAll("option")).map(
      (option) => option.textContent,
    );
    expect(rendered).toEqual(["Roofing"]);
  });

  it("reports selection changes and flags errors", () => {
    const onChange = vi.fn();
    renderWithTheme(
      <Select
        aria-label="Company type"
        options={options}
        hasError
        onChange={onChange}
      />,
    );

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.getAttribute("aria-invalid")).toBe("true");

    fireEvent.change(select, { target: { value: "subcontractor" } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("forwards ref and id to the underlying select", () => {
    const ref = React.createRef<HTMLSelectElement>();
    renderWithTheme(
      <Select
        ref={ref}
        id="company-type"
        aria-label="Company type"
        options={options}
      />,
    );

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(ref.current).toBe(select);
    expect(select.id).toBe("company-type");
  });
});
