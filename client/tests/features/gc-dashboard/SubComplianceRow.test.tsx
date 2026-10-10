import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { MemoryRouter } from "react-router-dom";

import { SubComplianceRow } from "../../../src/features/gc-dashboard/SubComplianceRow";
import theme from "../../../src/styles/theme";
import type { GcSubCompliance } from "../../../src/interfaces/gcDashboard";

const sub: GcSubCompliance = {
  companyId: "sub-1",
  companyName: "Rivera Electric",
  projectId: "project-1",
  cadence: "daily",
  status: "logged",
  lastLoggedAt: "2026-09-21T13:00:00.000Z",
  count: 1,
  inHouse: false,
  locked: false,
};

const renderRow = (
  overrides: Partial<GcSubCompliance> = {},
  onSelect = vi.fn(),
  onUnlock = vi.fn(),
) =>
  render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <ul>
          <SubComplianceRow
            sub={{ ...sub, ...overrides }}
            onSelect={onSelect}
            onUnlock={onUnlock}
          />
        </ul>
      </ThemeProvider>
    </MemoryRouter>,
  );

describe("SubComplianceRow", () => {
  it("renders the sub's name and a Logged pill with the last-logged time", () => {
    renderRow();

    expect(screen.getByText("Rivera Electric")).toBeDefined();
    expect(screen.getByText("Logged")).toBeDefined();
    expect(screen.getByText(/last logged/i)).toBeDefined();
  });

  it("renders a Missing pill and a no-talk message when the sub hasn't logged", () => {
    renderRow({ status: "missing", lastLoggedAt: null, count: 0 });

    expect(screen.getByText("Missing")).toBeDefined();
    expect(screen.getByText("No talk logged today")).toBeDefined();
  });

  it("says 'this week' in the no-talk message for a weekly sub", () => {
    renderRow({ status: "missing", lastLoggedAt: null, count: 0, cadence: "weekly" });

    expect(screen.getByText("No talk logged this week")).toBeDefined();
  });

  it("falls back to a placeholder name when companyName is null", () => {
    renderRow({ companyName: null });

    expect(screen.getByText("Unknown company")).toBeDefined();
  });

  it("renders a locked sub as a placeholder whose unlock button fires onUnlock, not onSelect", () => {
    const onSelect = vi.fn();
    const onUnlock = vi.fn();
    renderRow(
      {
        locked: true,
        companyId: null,
        companyName: null,
        projectId: null,
        cadence: null,
        status: null,
        lastLoggedAt: null,
        count: null,
      },
      onSelect,
      onUnlock,
    );

    expect(screen.queryByText("Logged")).toBeNull();
    expect(screen.queryByText("Missing")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /unlock on site pro/i }));
    expect(onUnlock).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("calls onSelect with the sub when clicked", () => {
    const onSelect = vi.fn();
    renderRow({}, onSelect);

    fireEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith(sub);
  });

  it("badges an in-house crew and leaves other subs unbadged", () => {
    renderRow({ inHouse: true });
    expect(screen.getByText("In-house")).toBeDefined();
  });

  it("does not badge an ordinary subcontractor", () => {
    renderRow();
    expect(screen.queryByText("In-house")).toBeNull();
  });
});
