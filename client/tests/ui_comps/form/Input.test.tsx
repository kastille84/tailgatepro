import React from "react";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { describe, expect, it } from "vitest";

import {
  Field,
  FieldError,
  Form,
  FormField,
  Input,
  Label,
} from "../../../src/ui_comps/form";
import theme from "../../../src/styles/theme";

describe("Input", () => {
  it("renders an accessible input with the expected placeholder", () => {
    render(
      <ThemeProvider theme={theme}>
        <Input aria-label="Work email" placeholder="you@company.com" />
      </ThemeProvider>,
    );

    const input = screen.getByLabelText(/work email/i);
    expect(input).toBeDefined();
    expect(input.getAttribute("placeholder")).toBe("you@company.com");
    expect(input.getAttribute("aria-invalid")).toBe("false");
  });

  it("marks the control invalid when the hasError prop is set", () => {
    render(
      <ThemeProvider theme={theme}>
        <Input aria-label="Company" hasError />
      </ThemeProvider>,
    );

    const input = screen.getByLabelText(/company/i);
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });

  it("exposes reusable form primitives for shared field layouts", () => {
    render(
      <ThemeProvider theme={theme}>
        <Form data-testid="shared-form">
          <Field>
            <Label htmlFor="buyer-name" $onDark>
              Buyer name
            </Label>
            <Input id="buyer-name" aria-label="Buyer name" hasError />
            <FieldError id="buyer-name-error" $onDark role="alert">
              Buyer name is required
            </FieldError>
          </Field>
        </Form>
      </ThemeProvider>,
    );

    const form = screen.getByTestId("shared-form");
    expect(form).toBeDefined();
    expect(screen.getByLabelText(/buyer name/i)).toBeDefined();
    expect(screen.getByRole("alert").textContent).toBe(
      "Buyer name is required",
    );
  });

  it("provides a reusable FormField helper for future forms", () => {
    render(
      <ThemeProvider theme={theme}>
        <Form>
          <FormField
            id="company"
            label="Company"
            error="Company name is too long"
            onDark={false}
          >
            <Input id="company" aria-label="Company" hasError />
          </FormField>
        </Form>
      </ThemeProvider>,
    );

    expect(screen.getByLabelText(/company/i)).toBeDefined();
    expect(screen.getByRole("alert").textContent).toBe(
      "Company name is too long",
    );
  });

  it("auto-wires aria guidance to the field child when FormField has an error", () => {
    render(
      <ThemeProvider theme={theme}>
        <Form>
          <FormField id="site" label="Site name" error="Site name is required">
            <Input id="site" aria-label="Site name" />
          </FormField>
        </Form>
      </ThemeProvider>,
    );

    const input = screen.getByLabelText(/site name/i) as HTMLInputElement;
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toContain("site-error");
  });

  it("renders helper text when provided", () => {
    render(
      <ThemeProvider theme={theme}>
        <Form>
          <FormField
            id="notes"
            label="Notes"
            helperText="Optional, but useful for internal context"
          >
            <Input id="notes" aria-label="Notes" />
          </FormField>
        </Form>
      </ThemeProvider>,
    );

    expect(
      screen.getByText(/Optional, but useful for internal context/i),
    ).toBeDefined();
  });

  it("renders a hint alias when provided", () => {
    render(
      <ThemeProvider theme={theme}>
        <Form>
          <FormField id="trade" label="Trade" hint="This is visible to your GC">
            <Input id="trade" aria-label="Trade" />
          </FormField>
        </Form>
      </ThemeProvider>,
    );

    expect(screen.getByText(/This is visible to your GC/i)).toBeDefined();
  });

  it("prefers the child existing aria-describedby value when FormField adds an error id", () => {
    render(
      <ThemeProvider theme={theme}>
        <Form>
          <FormField id="email" label="Email" error="Email is required">
            <Input
              id="email"
              aria-label="Email"
              aria-describedby="existing-help"
            />
          </FormField>
        </Form>
      </ThemeProvider>,
    );

    const input = screen.getByLabelText(/email/i) as HTMLInputElement;
    expect(input.getAttribute("aria-describedby")).toContain("existing-help");
    expect(input.getAttribute("aria-describedby")).toContain("email-error");
  });

  it("does not render helper text or error markup when no text is provided", () => {
    render(
      <ThemeProvider theme={theme}>
        <Form>
          <FormField id="trade" label="Trade">
            <Input id="trade" aria-label="Trade" />
          </FormField>
        </Form>
      </ThemeProvider>,
    );

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/visible to your GC/i)).toBeNull();
  });

  it("renders plain-text children without trying to clone them", () => {
    render(
      <ThemeProvider theme={theme}>
        <Form>
          <FormField id="plain" label="Plain field">
            Plain text content
          </FormField>
        </Form>
      </ThemeProvider>,
    );

    expect(screen.getByText("Plain text content")).toBeDefined();
    expect(screen.getByText("Plain field")).toBeDefined();
  });

  it("covers the dark-mode helper branch and the child id fallback path", () => {
    render(
      <ThemeProvider theme={theme}>
        <Form>
          <FormField
            id="dark-field"
            label="Dark field"
            hint="Visible on dark mode"
            onDark
          >
            <Input aria-label="Dark field" />
          </FormField>
        </Form>
      </ThemeProvider>,
    );

    const input = screen.getByLabelText(/dark field/i) as HTMLInputElement;
    expect(input.id).toBe("dark-field");
    expect(screen.getByText("Visible on dark mode")).toBeDefined();
  });
});
