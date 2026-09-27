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
  status: "logged",
  lastLoggedAt: "2026-09-21T13:00:00.000Z",
  count: 1,
  locked: false,
};

const renderRow = (
  overrides: Partial<GcSubCompliance> = {},
  onSelect = vi.fn(),
) =>
  render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <ul>
          <SubComplianceRow sub={{ ...sub, ...overrides }} onSelect={onSelect} />
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

  it("falls back to a placeholder name when companyName is null", () => {
    renderRow({ companyName: null });

    expect(screen.getByText("Unknown company")).toBeDefined();
  });

  it("renders a locked sub as a non-clickable placeholder with an upgrade link", () => {
    const onSelect = vi.fn();
    renderRow(
      {
        locked: true,
        companyId: null,
        companyName: null,
        projectId: null,
        status: null,
        lastLoggedAt: null,
        count: null,
      },
      onSelect,
    );

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText("Logged")).toBeNull();
    expect(screen.queryByText("Missing")).toBeNull();
    const link = screen.getByRole("link", { name: /unlock on site pro/i });
    expect(link.getAttribute("href")).toBe("/pricing");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("calls onSelect with the sub when clicked", () => {
    const onSelect = vi.fn();
    renderRow({}, onSelect);

    fireEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith(sub);
  });
});
