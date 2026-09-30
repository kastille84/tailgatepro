import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
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

const mockUseAuth = vi.fn();
vi.mock("../../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockUseCurrentUser = vi.fn();
vi.mock("../../../src/hooks/useCurrentUser", () => ({
  useCurrentUser: () => mockUseCurrentUser(),
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
      id: "trade-free",
      name: "Trade Free",
      target: "Small crews",
      featured: false,
      price: { monthly: "$0", annual: "$0" },
      annualSub: "Always free",
      features: ["Feature A", "Feature B"],
      comingSoon: ["Feature B"],
    },
    {
      id: "trade-pro",
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

const hrefOf = (name: string | RegExp) =>
  screen.getByRole("link", { name }).getAttribute("href");

describe("Pricing page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: null });
    mockUseCurrentUser.mockReturnValue({
      companyType: null,
      isManagerRole: false,
      plan: null,
    });
  });

  it("renders subcontractor plans by default", () => {
    renderPricing();

    expect(screen.getByRole("heading", { name: "Trade Free" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Trade Pro" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "GC Site Pro" })).toBeNull();
  });

  it("always renders the Site Pro waitlist form", () => {
    renderPricing();

    const waitlist = screen.getByTestId("waitlist-form");
    expect(waitlist.getAttribute("data-audience")).toBe("gc");
    expect(waitlist.getAttribute("data-plan-interest")).toBe("gc-site-pro");
    expect(
      screen.getByRole("heading", { name: /gc site pro is coming soon/i }),
    ).toBeTruthy();
  });

  it("starts on the GC plans when the audience query param says so", () => {
    renderPricing("/pricing?audience=gc");

    expect(screen.getByRole("heading", { name: "GC Site Pro" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "GC Portfolio" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Trade Free" })).toBeNull();
  });

  it("switches audience with the toggle", async () => {
    const user = userEvent.setup();
    renderPricing();

    await user.click(
      screen.getByRole("button", { name: "For general contractors" }),
    );

    expect(screen.getByRole("heading", { name: "GC Portfolio" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Trade Pro" })).toBeNull();
  });

  describe("for a visitor", () => {
    it("sends the free plan to signup and a paid plan to signup with the plan", () => {
      renderPricing();

      expect(hrefOf("Get started free")).toBe("/signup");
      expect(hrefOf("Get started")).toBe("/signup?plan=trade-pro&interval=monthly");
    });

    it("carries the annual interval into the signup link", async () => {
      const user = userEvent.setup();
      renderPricing();

      await user.click(screen.getByRole("button", { name: "Annual" }));

      expect(hrefOf("Get started")).toBe("/signup?plan=trade-pro&interval=annual");
    });

    it("offers both GC Portfolio sizes and the Site Pro waitlist", () => {
      renderPricing("/pricing?audience=gc");

      expect(hrefOf("Get started: up to 10 sites")).toBe(
        "/signup?plan=gc-portfolio-10&interval=monthly",
      );
      expect(hrefOf("Get started: unlimited sites")).toBe(
        "/signup?plan=gc-portfolio-unlimited&interval=monthly",
      );
      expect(hrefOf("Join the waitlist")).toBe("#pricing-waitlist");
    });
  });

  describe("for a signed-in user", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user: { id: "user-1" } });
      mockUseCurrentUser.mockReturnValue({
        companyType: "subcontractor",
        isManagerRole: true,
        plan: "trade-free",
      });
    });

    it("sends a manager straight to checkout", () => {
      renderPricing();

      expect(hrefOf("Go to dashboard")).toBe("/dashboard");
      expect(hrefOf("Subscribe")).toBe("/checkout?plan=trade-pro&interval=monthly");
    });

    it("shows their own plan as the current plan", () => {
      mockUseCurrentUser.mockReturnValue({
        companyType: "subcontractor",
        isManagerRole: true,
        plan: "trade-pro",
      });
      renderPricing();

      const current = screen.getByText("Current plan");
      expect(current.getAttribute("aria-disabled")).toBe("true");
      expect(screen.queryByRole("link", { name: "Subscribe" })).toBeNull();
    });
  });

  it("tags only the comingSoon features with a Coming soon label", () => {
    renderPricing();

    expect(
      within(screen.getByText("Feature B")).getByText("Coming soon"),
    ).toBeTruthy();
    expect(
      within(screen.getByText("Feature A")).queryByText("Coming soon"),
    ).toBeNull();
    expect(screen.getAllByText("Coming soon")).toHaveLength(1);
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
