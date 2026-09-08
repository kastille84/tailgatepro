import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { describe, expect, it, vi } from "vitest";

import { Modal } from "../../../src/ui_comps/modal";
import theme from "../../../src/styles/theme";

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe("Modal", () => {
  it("renders nothing while closed", () => {
    renderWithTheme(
      <Modal isOpen={false} onClose={() => {}} title="New project">
        <p>Body</p>
      </Modal>,
    );

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders an accessible dialog labelled by its title when open", () => {
    renderWithTheme(
      <Modal isOpen onClose={() => {}} title="New project">
        <p>Body</p>
      </Modal>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const labelId = dialog.getAttribute("aria-labelledby");
    expect(labelId).toBeTruthy();
    expect(document.getElementById(labelId as string)?.textContent).toBe(
      "New project",
    );
  });

  it("closes on Escape, overlay click, and the close button", () => {
    const onClose = vi.fn();
    renderWithTheme(
      <Modal isOpen onClose={onClose} title="New project">
        <p>Body</p>
      </Modal>,
    );

    fireEvent.keyDown(screen.getByTestId("modal-overlay"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.mouseDown(screen.getByTestId("modal-overlay"));
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("button", { name: /close dialog/i }));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("does not close on clicks inside the panel", () => {
    const onClose = vi.fn();
    renderWithTheme(
      <Modal isOpen onClose={onClose} title="New project">
        <p>Body content</p>
      </Modal>,
    );

    fireEvent.mouseDown(screen.getByText("Body content"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("ignores Escape and overlay clicks and hides the close button when not dismissable", () => {
    const onClose = vi.fn();
    renderWithTheme(
      <Modal isOpen onClose={onClose} title="Working" dismissable={false}>
        <p>Body</p>
      </Modal>,
    );

    fireEvent.keyDown(screen.getByTestId("modal-overlay"), { key: "Escape" });
    fireEvent.mouseDown(screen.getByTestId("modal-overlay"));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /close dialog/i })).toBeNull();
  });

  it("moves focus into the dialog on open and restores it to the trigger on close", () => {
    const Harness = () => {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          <Modal isOpen={open} onClose={() => setOpen(false)} title="New project">
            <button type="button">Inside</button>
          </Modal>
        </>
      );
    };

    renderWithTheme(<Harness />);

    const opener = screen.getByRole("button", { name: "Open" });
    opener.focus();
    fireEvent.click(opener);

    // focus moved somewhere inside the open dialog
    const dialog = screen.getByRole("dialog");
    expect(dialog.contains(document.activeElement)).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /close dialog/i }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("keeps Tab focus cycling within the dialog", () => {
    renderWithTheme(
      <Modal isOpen onClose={() => {}} title="New project">
        <button type="button">First inside</button>
        <button type="button">Last inside</button>
      </Modal>,
    );

    const overlay = screen.getByTestId("modal-overlay");
    const closeButton = screen.getByRole("button", { name: /close dialog/i });
    const lastButton = screen.getByRole("button", { name: "Last inside" });

    // Tab off the last element wraps back to the first (the close button).
    lastButton.focus();
    fireEvent.keyDown(overlay, { key: "Tab" });
    expect(document.activeElement).toBe(closeButton);

    // Shift+Tab off the first element wraps to the last.
    closeButton.focus();
    fireEvent.keyDown(overlay, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(lastButton);
  });

  it("swallows Tab when the dialog has no focusable content", () => {
    renderWithTheme(
      <Modal isOpen onClose={() => {}} title="Working" dismissable={false}>
        <p>Please wait</p>
      </Modal>,
    );

    const overlay = screen.getByTestId("modal-overlay");
    const event = fireEvent.keyDown(overlay, { key: "Tab" });
    // handler calls preventDefault, so the dispatched event is reported cancelled
    expect(event).toBe(false);
  });

  it("locks body scroll while open and restores it on close", () => {
    const { rerender } = renderWithTheme(
      <Modal isOpen onClose={() => {}} title="New project">
        <p>Body</p>
      </Modal>,
    );

    expect(document.body.style.overflow).toBe("hidden");

    rerender(
      <ThemeProvider theme={theme}>
        <Modal isOpen={false} onClose={() => {}} title="New project">
          <p>Body</p>
        </Modal>
      </ThemeProvider>,
    );

    expect(document.body.style.overflow).toBe("");
  });
});
