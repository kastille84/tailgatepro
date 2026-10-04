import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "styled-components";
import { describe, expect, it, vi } from "vitest";

import {
  getUpgradeCopy,
  THREE_SITES_MONTHLY,
  type UpgradeTrigger,
} from "../../../src/constants/upgradeTriggers";
import theme from "../../../src/styles/theme";
import { UpgradeModal } from "../../../src/ui_comps/upgrade-modal";

const renderModal = (ui: React.ReactElement) =>
  render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>{ui}</ThemeProvider>
    </MemoryRouter>,
  );

describe("UpgradeModal", () => {
  it("renders nothing without a trigger", () => {
    renderModal(<UpgradeModal trigger={null} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the trigger's copy and a /pricing CTA", () => {
    renderModal(<UpgradeModal trigger="second-foreman" onClose={vi.fn()} />);

    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText(/up to 8 foremen/)).toBeDefined();
    expect(
      screen.getByRole("link", { name: "Upgrade to Trade Pro" }).getAttribute("href"),
    ).toBe("/pricing");
  });

  it("closes from Not now and from the CTA", () => {
    const onClose = vi.fn();
    renderModal(<UpgradeModal trigger="scorecard" onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    fireEvent.click(screen.getByRole("link", { name: "Upgrade to GC Portfolio" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("renders the CTA as a button that runs onUpgrade when one is given", () => {
    const onUpgrade = vi.fn();
    renderModal(
      <UpgradeModal trigger="sub-blur" onClose={vi.fn()} onUpgrade={onUpgrade} />,
    );

    expect(screen.queryByRole("link", { name: "Upgrade to GC Site Pro" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Upgrade to GC Site Pro" }));

    expect(onUpgrade).toHaveBeenCalledTimes(1);
  });

  it("fills the sub-blur copy from params", () => {
    renderModal(
      <UpgradeModal
        trigger="sub-blur"
        params={{ subCount: 3, siteName: "Downtown Site" }}
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/3 Subcontractors are actively logging safety talks on Downtown Site/),
    ).toBeDefined();
  });
});

describe("getUpgradeCopy", () => {
  it("falls back to defaults for sub-blur without params", () => {
    expect(getUpgradeCopy("sub-blur").body).toContain(
      "2 Subcontractors are actively logging safety talks on your site",
    );
  });

  it("computes the 4th-site price comparison from the plan catalog", () => {
    expect(THREE_SITES_MONTHLY).toBe(447);
    expect(getUpgradeCopy("fourth-site").body).toContain("$447/mo");
    expect(getUpgradeCopy("fourth-site").body).toContain("$499/mo");
  });

  it.each<UpgradeTrigger>([
    "second-foreman",
    "history-lockout",
    "sub-blur",
    "fourth-site",
    "policy-push",
    "scorecard",
  ])("has a title, body and CTA for %s", (trigger) => {
    const copy = getUpgradeCopy(trigger);
    expect(copy.title).not.toBe("");
    expect(copy.body).not.toBe("");
    expect(copy.cta).not.toBe("");
  });
});
