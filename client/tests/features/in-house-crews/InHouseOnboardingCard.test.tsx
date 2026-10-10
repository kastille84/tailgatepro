import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { InHouseOnboardingCard } from "../../../src/features/in-house-crews/InHouseOnboardingCard";
import theme from "../../../src/styles/theme";

const renderCard = (onAddCrews = vi.fn()) => {
  render(
    <ThemeProvider theme={theme}>
      <InHouseOnboardingCard companyId="gc-1" onAddCrews={onAddCrews} />
    </ThemeProvider>,
  );
  return onAddCrews;
};

describe("InHouseOnboardingCard", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("explains what in-house crews are and where to manage them", () => {
    renderCard();

    expect(screen.getByRole("heading", { name: /does your company have its own crews/i })).toBeDefined();
    expect(screen.getByText(/choose which job sites it works on/i)).toBeDefined();
    expect(screen.getByText(/in-house badge/i)).toBeDefined();
    expect(screen.getByText(/settings → in-house crews/i)).toBeDefined();
  });

  it("opens the crew form from Yes", () => {
    const onAddCrews = renderCard();

    fireEvent.click(screen.getByRole("button", { name: "Yes, add my crews" }));

    expect(onAddCrews).toHaveBeenCalled();
  });

  it("hides on Not now and remembers it for this company", () => {
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: "Not now" }));

    expect(screen.queryByRole("heading")).toBeNull();
    expect(localStorage.getItem("tailgatepro.inHouseCrewsPrompt.gc-1")).toBe("dismissed");
  });

  it("stays hidden once dismissed", () => {
    localStorage.setItem("tailgatepro.inHouseCrewsPrompt.gc-1", "dismissed");
    renderCard();

    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("still dismisses for the session when storage cannot be written", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: "Not now" }));

    expect(screen.queryByRole("heading")).toBeNull();
  });
});
