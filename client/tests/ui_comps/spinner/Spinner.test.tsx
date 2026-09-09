import React from "react";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { afterEach, describe, expect, it } from "vitest";

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

  describe("fullScreen", () => {
    afterEach(() => {
      document.body.style.overflow = "";
    });

    it("portals a full-viewport overlay into document.body", () => {
      const { container } = renderWithTheme(<Spinner fullScreen />);

      const status = screen.getByRole("status");
      expect(container.contains(status)).toBe(false);
      expect(document.body.contains(status)).toBe(true);
    });

    it("locks body scroll while mounted and restores it on unmount", () => {
      document.body.style.overflow = "auto";

      const { unmount } = renderWithTheme(<Spinner fullScreen />);
      expect(document.body.style.overflow).toBe("hidden");

      unmount();
      expect(document.body.style.overflow).toBe("auto");
    });

    it("defaults the ring to the large size, but an explicit size still wins", () => {
      const { unmount } = renderWithTheme(<Spinner fullScreen />);
      expect(getComputedStyle(screen.getByRole("status")).width).toBe("4rem");
      unmount();

      renderWithTheme(<Spinner fullScreen size="sm" />);
      expect(getComputedStyle(screen.getByRole("status")).width).toBe("1.6rem");
    });
  });

  describe("message", () => {
    it("renders a visible caption and uses it as the accessible name", () => {
      renderWithTheme(<Spinner message="Syncing meeting log…" />);

      expect(screen.getByText("Syncing meeting log…")).toBeDefined();
      expect(
        screen.getByRole("status", { name: /syncing meeting log/i }),
      ).toBeDefined();
    });

    it("wraps a bare message in the centered block", () => {
      const { container } = renderWithTheme(<Spinner message="Loading project" />);

      const status = screen.getByRole("status");
      expect(status.parentElement).not.toBe(container);
      expect(status.parentElement?.tagName).toBe("SPAN");
    });
  });
});
