import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { DefenseBundleProgressModal } from "../../../src/features/jobsites/DefenseBundleProgressModal";
import theme from "../../../src/styles/theme";

const renderModal = (isOpen: boolean) =>
  render(
    <ThemeProvider theme={theme}>
      <DefenseBundleProgressModal isOpen={isOpen} />
    </ThemeProvider>,
  );

describe("DefenseBundleProgressModal", () => {
  it("renders nothing when closed", () => {
    renderModal(false);

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the title and an explanatory spinner message while open", () => {
    renderModal(true);

    expect(screen.getByRole("dialog").textContent).toContain("Preparing your Defense Bundle");
    expect(screen.getByText(/this can take a minute or two/i)).toBeDefined();
    expect(screen.getByRole("status")).toBeDefined();
  });

  it("cannot be dismissed via a close button or the Escape key", () => {
    renderModal(true);

    expect(screen.queryByLabelText(/close dialog/i)).toBeNull();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeDefined();
  });
});
