import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "../../../src/ui_comps/confirm-dialog";
import theme from "../../../src/styles/theme";

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

const baseProps = {
  isOpen: true,
  title: "Delete project",
  confirmLabel: "Delete project",
  onConfirm: vi.fn(),
  onClose: vi.fn(),
};

describe("ConfirmDialog", () => {
  it("renders nothing while closed", () => {
    renderWithTheme(
      <ConfirmDialog {...baseProps} isOpen={false}>
        This can't be undone.
      </ConfirmDialog>,
    );

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders the title and body when open", () => {
    renderWithTheme(
      <ConfirmDialog {...baseProps}>This can't be undone.</ConfirmDialog>,
    );

    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText("This can't be undone.")).toBeDefined();
  });

  it("calls onConfirm when the confirm button is clicked", () => {
    const onConfirm = vi.fn();
    renderWithTheme(
      <ConfirmDialog {...baseProps} onConfirm={onConfirm}>
        Body
      </ConfirmDialog>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Delete project" }),
    );
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onClose from Cancel and from the modal's Escape/overlay", () => {
    const onClose = vi.fn();
    renderWithTheme(
      <ConfirmDialog {...baseProps} onClose={onClose}>
        Body
      </ConfirmDialog>,
    );

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    fireEvent.keyDown(screen.getByTestId("modal-overlay"), { key: "Escape" });
    fireEvent.mouseDown(screen.getByTestId("modal-overlay"));

    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("forwards confirmVariant so the danger button renders differently from the default", () => {
    const { rerender } = renderWithTheme(
      <ConfirmDialog {...baseProps} confirmVariant="primary">
        Body
      </ConfirmDialog>,
    );
    const primaryClass = screen.getByRole("button", {
      name: "Delete project",
    }).className;

    rerender(
      <ThemeProvider theme={theme}>
        <ConfirmDialog {...baseProps} confirmVariant="danger">
          Body
        </ConfirmDialog>
      </ThemeProvider>,
    );
    const dangerClass = screen.getByRole("button", {
      name: "Delete project",
    }).className;

    expect(dangerClass).not.toBe(primaryClass);
  });

  it("disables the confirm button while busy", () => {
    renderWithTheme(
      <ConfirmDialog {...baseProps} isBusy>
        Body
      </ConfirmDialog>,
    );

    const confirm = screen.getByRole("button", {
      name: "Delete project",
    }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    expect(confirm.getAttribute("aria-busy")).toBe("true");
  });
});
