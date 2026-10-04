import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { SiteProCheckoutModal } from "../../../src/features/jobsites/SiteProCheckoutModal";
import theme from "../../../src/styles/theme";

const mockUseSiteCheckout = vi.fn();
vi.mock("../../../src/hooks/useSiteCheckout", () => ({
  useSiteCheckout: () => mockUseSiteCheckout(),
}));

const renderModal = (
  props: Partial<React.ComponentProps<typeof SiteProCheckoutModal>> = {},
) =>
  render(
    <ThemeProvider theme={theme}>
      <SiteProCheckoutModal
        jobsite={{ id: "site-1", name: "Riverside" }}
        isOnline
        onClose={vi.fn()}
        {...props}
      />
    </ThemeProvider>,
  );

const monthly = () => screen.getByRole("button", { name: "$149/mo" }) as HTMLButtonElement;
const annual = () =>
  screen.getByRole("button", { name: /\$1,490\/yr/ }) as HTMLButtonElement;

describe("SiteProCheckoutModal", () => {
  const startSiteCheckout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSiteCheckout.mockReturnValue({ startSiteCheckout, isStarting: false });
  });

  it("renders nothing when no jobsite is selected", () => {
    renderModal({ jobsite: null });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("names the jobsite and both prices", () => {
    renderModal();

    expect(screen.getByRole("dialog").textContent).toContain("Riverside");
    expect(monthly()).toBeDefined();
    expect(annual()).toBeDefined();
  });

  it("starts a monthly checkout for that jobsite", () => {
    renderModal();

    fireEvent.click(monthly());

    expect(startSiteCheckout).toHaveBeenCalledWith({
      jobsiteId: "site-1",
      interval: "monthly",
    });
  });

  it("starts an annual checkout for that jobsite", () => {
    renderModal();

    fireEvent.click(annual());

    expect(startSiteCheckout).toHaveBeenCalledWith({
      jobsiteId: "site-1",
      interval: "annual",
    });
  });

  it("disables both buttons while offline", () => {
    renderModal({ isOnline: false });

    expect(monthly().disabled).toBe(true);
    expect(annual().disabled).toBe(true);
  });

  it("disables both buttons while a checkout is starting", () => {
    mockUseSiteCheckout.mockReturnValue({ startSiteCheckout, isStarting: true });
    renderModal();

    expect(annual().disabled).toBe(true);
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(onClose).toHaveBeenCalled();
  });
});
