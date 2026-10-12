import React from "react";
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { MemoryRouter } from "react-router-dom";

import { HowItHelps } from "../../../src/pages/HowItHelps/HowItHelps";
import { TIMELINE_STEPS } from "../../../src/pages/HowItHelps/HowItHelpsContent";
import theme from "../../../src/styles/theme";

vi.mock("../../../src/pages/Landing/GcDashboardMockup", () => ({
  GcDashboardMockup: () => <div data-testid="gc-mockup" />,
}));
vi.mock("../../../src/pages/Landing/PhoneMockup", () => ({
  PhoneMockup: () => <div data-testid="phone-mockup" />,
}));
vi.mock("../../../src/pages/Landing/CompliancePdfCard", () => ({
  CompliancePdfCard: () => <div data-testid="pdf-card" />,
}));

const renderPage = (route = "/how-it-helps") =>
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[route]}>
        <HowItHelps />
      </MemoryRouter>
    </ThemeProvider>,
  );

describe("HowItHelps", () => {
  it("renders the hero and defaults to the GC view", () => {
    renderPage();

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /when something goes wrong, the record is what protects you/i,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: /you're the one who gets named/i }),
    ).toBeTruthy();
    expect(screen.getByTestId("gc-mockup")).toBeTruthy();
    expect(screen.queryByTestId("phone-mockup")).toBeNull();
    expect(screen.getByText("No per-user fees")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /for gcs/i }).getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("swaps to the sub view when the toggle is tapped", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /for subs/i }));

    expect(
      screen.getByRole("heading", { name: /osha calls you first/i }),
    ).toBeTruthy();
    expect(screen.getByTestId("phone-mockup")).toBeTruthy();
    expect(screen.getByTestId("pdf-card")).toBeTruthy();
    expect(screen.queryByTestId("gc-mockup")).toBeNull();
    expect(screen.queryByText("No per-user fees")).toBeNull();
  });

  it("shows a talk-running CTA on the sub view", () => {
    renderPage("/how-it-helps?audience=sub");

    expect(
      screen.getByText(/create a free account and run your first talk today/i),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /get started free/i }).getAttribute("href"),
    ).toBe("/signup");
  });

  it("starts on the sub view for ?audience=sub", () => {
    renderPage("/how-it-helps?audience=sub");

    expect(
      screen.getByRole("heading", { name: /osha calls you first/i }),
    ).toBeTruthy();
  });

  it("renders every timeline step", () => {
    renderPage();

    TIMELINE_STEPS.forEach(({ title }) => {
      expect(screen.getByRole("heading", { name: title })).toBeTruthy();
    });
  });

  it("labels each timeline rating as how much TailgatePro helps", () => {
    renderPage();

    const timeline = within(
      screen.getByRole("region", { name: /what happens next/i }),
    );

    expect(timeline.getAllByText("How TailgatePro helps")).toHaveLength(
      TIMELINE_STEPS.length,
    );
    ["Helps", "Strong", "Strongest"].forEach((label) => {
      expect(timeline.getAllByText(label).length).toBeGreaterThan(0);
    });

  });

  it("lists what TailgatePro does not do", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: /what tailgatepro doesn't do/i }),
    ).toBeTruthy();
    expect(screen.getByText(/not legal advice/i)).toBeTruthy();
  });

  it("links the closing CTAs to signup and pricing", () => {
    renderPage();

    expect(
      screen
        .getByRole("link", { name: /create a free gc account/i })
        .getAttribute("href"),
    ).toBe("/signup");
    expect(
      screen.getByRole("link", { name: /see pricing/i }).getAttribute("href"),
    ).toBe("/pricing");
  });

  it("sets the document title while mounted and restores it on unmount", () => {
    document.title = "Before";
    const { unmount } = renderPage();

    expect(document.title).toBe("How TailgatePro Helps");
    unmount();
    expect(document.title).toBe("Before");
  });
});
