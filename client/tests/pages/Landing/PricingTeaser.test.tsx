import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "styled-components";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { PricingTeaser } from "../../../src/pages/Landing/PricingTeaser";
import theme from "../../../src/styles/theme";

// No shipped plan is flagged comingSoon any more, so the tag behaviour is
// exercised against a plan flagged here (same approach as Pricing.test.tsx).
vi.mock("../../../src/data/plans", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/data/plans")>();
  return {
    ...actual,
    GC_PLANS: actual.GC_PLANS.map((plan) =>
      plan.id === "gc-site-pro"
        ? { ...plan, comingSoon: ["Procore & Autodesk ACC sync — single project"] }
        : plan,
    ),
  };
});

describe("PricingTeaser", () => {
  it("renders the pricing preview heading and audience selector", () => {
    render(
      <MemoryRouter>
        <ThemeProvider theme={theme}>
          <PricingTeaser />
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText(/Pricing built around the jobsite/i)).toBeDefined();
    expect(
      screen.getByRole("button", { name: /for subcontractors/i }),
    ).toBeDefined();
    expect(
      screen.getByRole("button", { name: /for general contractors/i }),
    ).toBeDefined();
  });

  it("switches the visible plans when the audience changes", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <ThemeProvider theme={theme}>
          <PricingTeaser />
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText("Trade Free")).toBeDefined();
    expect(screen.queryByText("GC Free Portal")).toBeNull();

    await user.click(
      screen.getByRole("button", { name: /for general contractors/i }),
    );

    expect(screen.getByText("GC Free Portal")).toBeDefined();
    expect(screen.queryByText("Trade Free")).toBeNull();

    const link = screen.getByRole("link", { name: /See full plan details/i });
    expect(link.getAttribute("href")).toBe("/pricing?audience=gc");
  });

  it("tags unbuilt features with Coming soon and leaves built ones untagged", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ThemeProvider theme={theme}>
          <PricingTeaser />
        </ThemeProvider>
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: /for general contractors/i }),
    );

    const unbuilt = screen.getByText("Procore & Autodesk ACC sync — single project");
    expect(within(unbuilt).getByText("Coming soon")).toBeDefined();

    const built = screen.getByText(/Automated SMS nudges/);
    expect(within(built).queryByText("Coming soon")).toBeNull();
  });
});
