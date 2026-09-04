import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { PhoneMockup } from "../../../src/pages/Landing/PhoneMockup";
import theme from "../../../src/styles/theme";

const renderMockup = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe("PhoneMockup", () => {
  it("exposes the label as an image role", () => {
    renderMockup(
      <PhoneMockup label="A phone showing the talk" screen="topics" />,
    );

    expect(
      screen.getByRole("img", { name: "A phone showing the talk" }),
    ).toBeTruthy();
  });

  it("draws the topics screen with the selected topic", () => {
    renderMockup(<PhoneMockup label="topics" screen="topics" tone="light" />);

    expect(screen.getByText("Today's talk")).toBeTruthy();
    expect(screen.getByText("Fall Protection")).toBeTruthy();
    expect(screen.getByText("Heat Illness")).toBeTruthy();
  });

  it("draws the signature screen with signer names", () => {
    renderMockup(
      <PhoneMockup label="signature" screen="signature" tone="dark" />,
    );

    expect(screen.getByText("Crew sign-off")).toBeTruthy();
    expect(screen.getByText("M. Rivera")).toBeTruthy();
  });

  it("draws the submitted screen with sync confirmation", () => {
    renderMockup(
      <PhoneMockup label="submitted" screen="submitted" tone="dark" />,
    );

    expect(screen.getByText("Talk submitted")).toBeTruthy();
    expect(
      screen.getByText("PDF sent to GC · synced 6:58 AM"),
    ).toBeTruthy();
  });
});
