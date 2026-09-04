import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Landing } from "../../../src/pages/Landing/Landing";
import theme from "../../../src/styles/theme";

vi.mock("../../../src/pages/Landing/WaitlistForm", () => ({
  WaitlistForm: ({ idPrefix }: { idPrefix: string }) => (
    <div data-testid={`waitlist-${idPrefix}`}>Join the launch waitlist</div>
  ),
}));

vi.mock("../../../src/pages/Landing/PricingTeaser", () => ({
  PricingTeaser: () => (
    <section aria-label="pricing teaser">
      <h2>Simple pricing, built for the field</h2>
    </section>
  ),
}));

describe("Landing", () => {
  const renderLanding = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <Landing />
        </ThemeProvider>
      </QueryClientProvider>,
    );
  };

  it("renders the hero heading and intro copy", () => {
    renderLanding();

    expect(
      screen.getByRole("heading", {
        name: /the toolbox talk, done before the crew gears up/i,
      }),
    ).toBeTruthy();

    expect(
      screen.getByText(
        /OSHA expects a toolbox talk before every shift\./i,
      ),
    ).toBeTruthy();
  });

  it("renders the problem section and all problem cards", () => {
    renderLanding();

    expect(
      screen.getByRole("heading", {
        name: /the paper safety log is a liability/i,
      }),
    ).toBeTruthy();

    [
      "Paper doesn't survive the field",
      "GCs chase every trade",
      "No proof until it's too late",
      "Built for the desk, not the site",
    ].forEach((title) => {
      expect(screen.getByText(title)).toBeTruthy();
    });

    expect(
      screen.getByText(
        /Every crew runs the talk\. Almost nobody can prove it cleanly\./i,
      ),
    ).toBeTruthy();
  });

  it("renders the how-it-works section and its three steps", () => {
    renderLanding();

    expect(
      screen.getByRole("heading", {
        name: /run the talk without slowing down the morning/i,
      }),
    ).toBeTruthy();

    ["Open with a tap", "Run the talk", "Submit"].forEach((title) => {
      expect(screen.getByRole("heading", { name: title })).toBeTruthy();
    });
  });

  it("renders the product showcase with device mockups", () => {
    renderLanding();

    expect(
      screen.getByRole("heading", { name: /see it the way the crew does/i }),
    ).toBeTruthy();

    expect(screen.getByText("What the GC receives")).toBeTruthy();
    expect(
      screen.getAllByRole("img", { name: /screen on a phone/i }).length,
    ).toBe(3);
  });

  it("renders the solution section and all solution cards", () => {
    renderLanding();

    expect(
      screen.getByRole("heading", {
        name: /why crews are going digital/i,
      }),
    ).toBeTruthy();

    [
      "Zero app-store friction",
      "Works offline, always",
      "Fast to run, every shift",
      "Instant compliance for the GC",
    ].forEach((title) => {
      expect(screen.getByText(title)).toBeTruthy();
    });

    expect(
      screen.getByText(
        /Same five-minute talk\. A compliance record the GC can see immediately\./i,
      ),
    ).toBeTruthy();
  });

  it("renders the general-contractor section and seat-tax callout", () => {
    renderLanding();

    expect(
      screen.getByRole("heading", {
        name: /one dashboard for every trade on the site/i,
      }),
    ).toBeTruthy();

    expect(
      screen.getByRole("heading", { name: /zero subcontractor seat tax/i }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        /no user-billing disputes, 100% site compliance on day one/i,
      ),
    ).toBeTruthy();
  });

  it("renders the comparison section with both columns and a feature row", () => {
    renderLanding();

    expect(
      screen.getByRole("heading", {
        name: /built for the field, not the office/i,
      }),
    ).toBeTruthy();

    expect(screen.getByText("Legacy safety apps")).toBeTruthy();
    expect(screen.getByText("Effort per talk")).toBeTruthy();
    expect(
      screen.getByText("One short routine, the same every shift"),
    ).toBeTruthy();
  });

  it("renders the pricing teaser section", () => {
    renderLanding();

    expect(screen.getByLabelText(/pricing teaser/i)).toBeTruthy();
    expect(
      screen.getByRole("heading", {
        name: /simple pricing, built for the field/i,
      }),
    ).toBeTruthy();
  });

  it("renders the FAQ section", () => {
    renderLanding();

    expect(
      screen.getByRole("heading", { name: /questions crews and gcs ask us/i }),
    ).toBeTruthy();
    expect(
      screen.getByText(/When can I actually sign up\?/i),
    ).toBeTruthy();
  });

  it("renders the CTA section, reassurances and footer branding", () => {
    renderLanding();

    expect(
      screen.getByRole("heading", {
        name: /be ready on day one/i,
      }),
    ).toBeTruthy();

    expect(
      screen.getByText(
        /Add your name and we'll set you up on the right plan the day we go live\./i,
      ),
    ).toBeTruthy();

    expect(
      screen.getByText(/No credit card, no app to install\./i),
    ).toBeTruthy();

    const year = new Date().getFullYear();
    expect(
      screen.getByText(new RegExp(`© ${year} TailgatePro`, "i")),
    ).toBeTruthy();
  });

  it("renders the hero image and its eager loading state", () => {
    renderLanding();

    const heroImage = screen.getByRole("img", {
      name: /a construction foreman leading a tailgate safety talk with his crew on a job site/i,
    });

    expect(heroImage).toBeTruthy();
    expect(heroImage.getAttribute("loading")).toBe("eager");
  });

  it("renders both waitlist forms and the launch-footnote text", () => {
    renderLanding();

    expect(screen.getByTestId("waitlist-hero")).toBeTruthy();
    expect(screen.getByTestId("waitlist-cta")).toBeTruthy();
    expect(
      screen.getByText(
        /Join the launch waitlist\. No spam — one email when we go live\./i,
      ),
    ).toBeTruthy();
  });
});
