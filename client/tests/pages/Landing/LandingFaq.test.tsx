import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "styled-components";

import { LandingFaq } from "../../../src/pages/Landing/LandingFaq";
import theme from "../../../src/styles/theme";

const renderFaq = () =>
  render(
    <ThemeProvider theme={theme}>
      <LandingFaq />
    </ThemeProvider>,
  );

describe("LandingFaq", () => {
  it("renders every question as a collapsed disclosure", () => {
    renderFaq();

    const questions = [
      "Do my sub-foremen need to download an app?",
      "Does it work with no signal?",
      "What does it cost the subcontractor?",
      "How does a GC sponsor subcontractors for free?",
      "When can I actually sign up?",
    ];

    questions.forEach((q) => {
      expect(screen.getByText(q)).toBeTruthy();
    });

    const [firstItem] = screen.getAllByRole("group");
    expect((firstItem as HTMLDetailsElement).open).toBe(false);
  });

  it("opens an answer when its question is clicked", async () => {
    const user = userEvent.setup();
    renderFaq();

    const summary = screen.getByText("Does it work with no signal?");
    await user.click(summary);

    const details = summary.closest("details") as HTMLDetailsElement;
    expect(details.open).toBe(true);
  });
});
