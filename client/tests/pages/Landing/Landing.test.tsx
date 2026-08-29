import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Landing } from "../../../src/pages/Landing/Landing";
import theme from "../../../src/styles/theme";

// Mock styled-components global styles
vi.mock("../../../src/styles/GlobalStyles", () => ({
  GlobalStyles: () => null,
}));

describe("Landing", () => {
  const renderWithTheme = (component: React.ReactElement) => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>{component}</ThemeProvider>
      </QueryClientProvider>,
    );
  };

  it("should render without crashing", () => {
    // Arrange & Act
    renderWithTheme(<Landing />);

    // Assert - getByText throws if element doesn't exist
    expect(() => screen.getByText(/Paperless Safety Talks/i)).not.toThrow();
  });

  it("should render the hero section with correct heading", () => {
    // Arrange & Act
    renderWithTheme(<Landing />);

    // Assert
    const heading = screen.getByRole("heading", {
      name: /Paperless Safety Talks/i,
    });
    expect(heading).toBeDefined();
  });

  it("should render the hero lede text", () => {
    // Arrange & Act
    renderWithTheme(<Landing />);

    // Assert
    expect(() =>
      screen.getByText(/OSHA expects a toolbox talk before the shift/i),
    ).not.toThrow();
  });

  it("should render the problem section with correct title", () => {
    // Arrange & Act
    renderWithTheme(<Landing />);

    // Assert
    expect(() =>
      screen.getByText(/The paper safety log is a liability/i),
    ).not.toThrow();
  });

  it("should render all problem cards with correct titles", () => {
    // Arrange & Act
    renderWithTheme(<Landing />);

    // Assert
    const problemTitles = [
      "Paper doesn't survive the field",
      "GCs chase every trade",
      "No proof until it's too late",
      "Built for the desk, not the site",
    ];

    problemTitles.forEach((title) => {
      expect(() => screen.getByText(title)).not.toThrow();
    });
  });

  it("should render all problem card body text", () => {
    // Arrange & Act
    renderWithTheme(<Landing />);

    // Assert
    expect(() =>
      screen.getByText(/Sign-in sheets get rained on/i),
    ).not.toThrow();
    expect(() =>
      screen.getByText(/Safety directors drive site to site/i),
    ).not.toThrow();
    expect(() =>
      screen.getByText(/There's no way to see a talk was skipped/i),
    ).not.toThrow();
    expect(() =>
      screen.getByText(/Clipboards and pens lose to bright sun/i),
    ).not.toThrow();
  });

  it("should render the solution section with correct title", () => {
    // Arrange & Act
    renderWithTheme(<Landing />);

    // Assert
    expect(() =>
      screen.getByText(/Why crews are going digital/i),
    ).not.toThrow();
  });

  it("should render all solution cards with correct titles", () => {
    // Arrange & Act
    renderWithTheme(<Landing />);

    // Assert
    const solutionTitles = [
      "Works with zero signal",
      "OSHA content, ready to run",
      "Sign-off in seconds",
      "Instant compliance for the GC",
    ];

    solutionTitles.forEach((title) => {
      expect(() => screen.getByText(title)).not.toThrow();
    });
  });

  it("should render all solution card body text", () => {
    // Arrange & Act
    renderWithTheme(<Landing />);

    // Assert
    expect(() =>
      screen.getByText(/Run the entire talk offline/i),
    ).not.toThrow();
    expect(() =>
      screen.getByText(/A library of compliant toolbox talks/i),
    ).not.toThrow();
    expect(() => screen.getByText(/The crew signs on-screen/i)).not.toThrow();
    expect(() =>
      screen.getByText(/Every completed talk lands on the general contractor/i),
    ).not.toThrow();
  });

  it("should render the CTA section with correct heading", () => {
    // Arrange & Act
    renderWithTheme(<Landing />);

    // Assert
    expect(() => screen.getByText(/Be ready on day one/i)).not.toThrow();
  });

  it("should render the CTA section lede text", () => {
    // Arrange & Act
    renderWithTheme(<Landing />);

    // Assert
    expect(() =>
      screen.getByText(
        /We're onboarding subcontractors and general contractors/i,
      ),
    ).not.toThrow();
  });

  it("should render the footer with brand mark", () => {
    // Arrange & Act
    renderWithTheme(<Landing />);

    // Assert
    expect(() => screen.getByText(/TAILGATEPRO/i)).not.toThrow();
  });

  it("should render the footer with correct copyright year", () => {
    // Arrange & Act
    renderWithTheme(<Landing />);
    const currentYear = new Date().getFullYear();

    // Assert
    expect(() =>
      screen.getByText(new RegExp(`© ${currentYear} TailgatePro`, "i")),
    ).not.toThrow();
  });

  it("should render the hero image with correct alt text", () => {
    // Arrange & Act
    renderWithTheme(<Landing />);

    // Assert
    const heroImage = screen.getByAltText(
      /A construction foreman leading a tailgate safety talk/i,
    );
    expect(heroImage).toBeDefined();
    expect(heroImage.getAttribute("loading")).toBe("eager");
  });

  it("should render exactly 4 problem cards", () => {
    // Arrange & Act
    renderWithTheme(<Landing />);

    // Assert
    const problemCards = screen.getAllByText(
      /Paper doesn't survive the field|GCs chase every trade|No proof until it's too late|Built for the desk, not the site/,
    );
    expect(problemCards.length).toBeGreaterThanOrEqual(4);
  });

  it("should render exactly 4 solution cards", () => {
    // Arrange & Act
    renderWithTheme(<Landing />);

    // Assert
    const solutionCards = screen.getAllByText(
      /Works with zero signal|OSHA content, ready to run|Sign-off in seconds|Instant compliance for the GC/,
    );
    expect(solutionCards.length).toBeGreaterThanOrEqual(4);
  });

  it("should render the section lede text in the problem section", () => {
    // Arrange & Act
    renderWithTheme(<Landing />);

    // Assert
    expect(() =>
      screen.getByText(
        /Every crew runs the talk. Almost nobody can prove it cleanly./i,
      ),
    ).not.toThrow();
  });

  it("should render the solution section lede text", () => {
    // Arrange & Act
    renderWithTheme(<Landing />);

    // Assert
    expect(() =>
      screen.getByText(
        /Same five-minute talk. A compliance record the GC can see immediately./i,
      ),
    ).not.toThrow();
  });

  it("should render the waitlist form join message", () => {
    // Arrange & Act
    renderWithTheme(<Landing />);

    // Assert
    expect(() =>
      screen.getByText(/No spam — one email when we go live/i),
    ).not.toThrow();
  });
});
