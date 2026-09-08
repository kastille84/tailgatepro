import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { describe, expect, it, vi } from "vitest";

import { Checkbox } from "../../../src/ui_comps/checkbox";
import theme from "../../../src/styles/theme";

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe("Checkbox", () => {
  it("renders a checkbox labelled by its visible text", () => {
    renderWithTheme(<Checkbox label="I ran the safety talk" />);

    const box = screen.getByRole("checkbox", { name: /i ran the safety talk/i });
    expect(box.getAttribute("type")).toBe("checkbox");
  });

  it("toggles and reports changes", () => {
    const onChange = vi.fn();
    renderWithTheme(<Checkbox label="Confirm" onChange={onChange} />);

    const box = screen.getByRole("checkbox") as HTMLInputElement;
    fireEvent.click(box);

    expect(box.checked).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("marks the input invalid and disabled when asked", () => {
    renderWithTheme(<Checkbox label="Confirm" hasError disabled />);

    const box = screen.getByRole("checkbox") as HTMLInputElement;
    expect(box.getAttribute("aria-invalid")).toBe("true");
    expect(box.disabled).toBe(true);
  });

  it("forwards ref and register-style props to the input", () => {
    const ref = React.createRef<HTMLInputElement>();
    renderWithTheme(
      <Checkbox ref={ref} label="Confirm" name="confirmed" id="confirm-field" />,
    );

    const box = screen.getByRole("checkbox") as HTMLInputElement;
    expect(ref.current).toBe(box);
    expect(box.name).toBe("confirmed");
    expect(box.id).toBe("confirm-field");
  });
});
