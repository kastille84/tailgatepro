import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { ProjectPicker } from "../../../src/features/meeting-flow/ProjectPicker";
import theme from "../../../src/styles/theme";
import type { Project } from "../../../src/interfaces/project";

const projects: Project[] = [
  {
    id: "p1",
    ownerCompanyId: "c1",
    name: "Downtown Highrise",
    gcCompanyId: null,
    gcNameCustom: "Acme GC",
    status: "active",
    archivedAt: null,
    createdAt: "x",
  },
  {
    id: "p2",
    ownerCompanyId: "c1",
    name: "Airport Expansion",
    gcCompanyId: null,
    gcNameCustom: null,
    status: "active",
    archivedAt: null,
    createdAt: "x",
  },
];

const renderPicker = (
  props: Partial<React.ComponentProps<typeof ProjectPicker>> = {},
) =>
  render(
    <ThemeProvider theme={theme}>
      <ProjectPicker projects={projects} onSelect={vi.fn()} {...props} />
    </ThemeProvider>,
  );

describe("ProjectPicker", () => {
  it("shows an empty state pointing at the Projects page when there are none", () => {
    renderPicker({ projects: [] });
    expect(screen.getByText(/no projects yet/i)).toBeDefined();
  });

  it("renders a card per project with its name and GC", () => {
    renderPicker();
    expect(screen.getByText("Downtown Highrise")).toBeDefined();
    expect(screen.getByText(/acme gc/i)).toBeDefined();
    expect(screen.getByText("GC: —")).toBeDefined();
  });

  it("never falls back to showing the raw GC company id", () => {
    renderPicker({
      projects: [
        { ...projects[1], gcCompanyId: "gc-uuid-123", gcNameCustom: null },
      ],
    });

    expect(screen.getByText("GC: —")).toBeDefined();
    expect(screen.queryByText(/gc-uuid-123/)).toBeNull();
  });

  it("calls onSelect with the project when its Select button is clicked", () => {
    const onSelect = vi.fn();
    renderPicker({ onSelect });

    fireEvent.click(
      screen.getByRole("button", { name: /select downtown highrise/i }),
    );

    expect(onSelect).toHaveBeenCalledWith(projects[0]);
  });

  it("passes jobsiteId through to onSelect untouched", () => {
    const onSelect = vi.fn();
    const linked = { ...projects[0], jobsiteId: "jobsite-1" };
    renderPicker({ projects: [linked], onSelect });

    fireEvent.click(
      screen.getByRole("button", { name: /select downtown highrise/i }),
    );

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ jobsiteId: "jobsite-1" }),
    );
  });
});
