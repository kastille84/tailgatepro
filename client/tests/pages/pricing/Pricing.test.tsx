import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "styled-components";

import { Pricing } from "../../../src/pages/Pricing/Pricing";
import theme from "../../../src/styles/theme";
import { planCadence } from "../../../src/utils/pricing";

const waitlistFormSpy = vi.fn(
  ({ audience, planInterest }: { audience: string; planInterest?: string }) => (
    <div
      data-testid="waitlist-form"
      data-audience={audience}
      data-plan-interest={planInterest ?? ""}
    />
  ),
);

vi.mock("../../../src/pages/Landing/WaitlistForm", () => ({
  WaitlistForm: (props: { audience: string; planInterest?: string }) =>
    waitlistFormSpy(props),
}));

vi.mock("../../../src/ui_comps/segmented-toggle", () => ({
  SegmentedToggle: <T extends string>({
    options,
    value,
    onChange,
    ariaLabel,
  }: {
    options: { value: T; label: string }[];
    value: T;
    onChange: (next: T) => void;
    ariaLabel: string;
  }) => (
    <div role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("../../../src/data/plans", () => ({
  SUB_PLANS: [
    {
      id: "sub-free",
      name: "Trade Free",
      target: "Small crews",
      featured: false,
      price: { monthly: "$0", annual: "$0" },
      annualSub: "Always free",
      features: ["Feature A", "Feature B"],
    },
    {
      id: "sub-pro",
      name: "Trade Pro",
      target: "Growing crews",
      featured: true,
      price: { monthly: "$49", annual: "$39" },
      annualSub: "Billed annually",
      features: ["Feature C"],
    },
  ],
  GC_PLANS: [
    {
      id: "gc-site-pro",
      name: "GC Site Pro",
      target: "Single site",
      featured: true,
      price: { monthly: "$149", annual: "$119" },
      annualSub: "Per site, billed annually",
      features: ["Feature D"],
    },
    {
      id: "gc-portfolio",
      name: "GC Portfolio",
      target: "Multi-site",
      featured: false,
      price: { monthly: "$499", annual: "$399" },
      annualSub: "Up to 10 sites, billed annually",
      features: ["Feature E"],
    },
  ],
}));

vi.mock("../../../src/utils/pricing", () => ({
  planCadence: vi.fn((_: unknown, billing: "monthly" | "annual") =>
    billing === "annual" ? "per year" : "per month",
  ),
}));

const renderPricing = (route = "/pricing") =>
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/pricing" element={<Pricing />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );

describe("Pricing page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders subcontractor plans by default and passes default waitlist props", () => {
    renderPricing();

    expect(screen.getByRole("heading", { name: "Trade Free" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Trade Pro" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "GC Site Pro" })).toBeNull();

    const waitlist = screen.getByTestId("waitlist-form");
    expect(waitlist.getAttribute("data-audience")).toBe("sub");
    expect(waitlist.getAttribute("data-plan-interest")).toBe("");

    expect(screen.queryByText("Selected plan:")).toBeNull();
  });

  it("hydrates audience and selected plan from query params", () => {
    renderPricing("/pricing?audience=gc&plan=gc-portfolio");

    expect(screen.getByRole("heading", { name: "GC Site Pro" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "GC Portfolio" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Trade Free" })).toBeNull();

    const selectedPlanNote = screen.getByText(/Selected plan:/i);
    expect(selectedPlanNote).toBeTruthy();
    expect(selectedPlanNote.textContent).toContain("GC Portfolio");

    const waitlist = screen.getByTestId("waitlist-form");
    expect(waitlist.getAttribute("data-audience")).toBe("gc");
    expect(waitlist.getAttribute("data-plan-interest")).toBe("gc-portfolio");
  });

  it("sets selected plan when clicking a plan CTA", async () => {
    const user = userEvent.setup();
    renderPricing();

    const ctas = screen.getAllByRole("link", { name: /join the waitlist/i });
    await user.click(ctas[1]);

    const selectedPlanNote = screen.getByText(/Selected plan:/i);
    expect(selectedPlanNote).toBeTruthy();
    expect(selectedPlanNote.textContent).toContain("Trade Pro");

    const waitlist = screen.getByTestId("waitlist-form");
    expect(waitlist.getAttribute("data-plan-interest")).toBe("sub-pro");
  });

  it("resets selected plan when audience changes", async () => {
    const user = userEvent.setup();
    renderPricing("/pricing?plan=sub-pro");

    const selectedPlanNote = screen.getByText(/Selected plan:/i);
    expect(selectedPlanNote).toBeTruthy();
    expect(selectedPlanNote.textContent).toContain("Trade Pro");

    await user.click(
      screen.getByRole("button", { name: "For general contractors" }),
    );

    expect(screen.queryByText(/Selected plan:/i)).toBeNull();

    const waitlist = screen.getByTestId("waitlist-form");
    expect(waitlist.getAttribute("data-audience")).toBe("gc");
    expect(waitlist.getAttribute("data-plan-interest")).toBe("");
  });

  it("updates billing and recalculates cadence when annual is selected", async () => {
    const user = userEvent.setup();
    renderPricing();

    expect(screen.queryByText("Billed annually")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Annual" }));

    expect(screen.getByText("Billed annually")).toBeTruthy();
    expect(screen.getByText("Always free")).toBeTruthy();

    expect(planCadence).toHaveBeenCalled();
    const calls = (planCadence as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.some(([, billing]) => billing === "annual")).toBe(true);
  });
});
