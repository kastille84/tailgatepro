import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { describe, expect, it } from "vitest";

import { PasswordInput } from "../../../src/ui_comps/password-input";
import theme from "../../../src/styles/theme";

const renderInput = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe("PasswordInput", () => {
  it("hides the password and offers a show toggle by default", () => {
    renderInput(<PasswordInput aria-label="Password" />);

    expect(screen.getByLabelText("Password").getAttribute("type")).toBe(
      "password",
    );
    expect(
      screen.getByRole("button", { name: /show password/i }),
    ).toBeDefined();
  });

  it("reveals the password when the toggle is pressed and hides it again", () => {
    renderInput(<PasswordInput aria-label="Password" />);

    const input = screen.getByLabelText("Password");
    fireEvent.click(screen.getByRole("button", { name: /show password/i }));

    expect(input.getAttribute("type")).toBe("text");
    const hideButton = screen.getByRole("button", { name: /hide password/i });
    expect(hideButton.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(hideButton);
    expect(input.getAttribute("type")).toBe("password");
  });

  it("starts revealed when defaultVisible is set", () => {
    renderInput(<PasswordInput aria-label="Password" defaultVisible />);

    expect(screen.getByLabelText("Password").getAttribute("type")).toBe("text");
    expect(
      screen.getByRole("button", { name: /hide password/i }),
    ).toBeDefined();
  });

  it("omits the toggle button when showToggle is false", () => {
    renderInput(
      <PasswordInput aria-label="Password" defaultVisible showToggle={false} />,
    );

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByLabelText("Password").getAttribute("type")).toBe("text");
  });

  it("forwards ref, id, and hasError to the underlying input", () => {
    const ref = React.createRef<HTMLInputElement>();
    renderInput(
      <PasswordInput
        ref={ref}
        id="signup-password"
        aria-label="Password"
        hasError
      />,
    );

    const input = screen.getByLabelText("Password");
    expect(ref.current).toBe(input);
    expect(input.id).toBe("signup-password");
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });
});
