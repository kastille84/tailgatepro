import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { ProjectList } from "../../../src/features/projects";
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
    gcNameCustom: "Skyline GC",
    status: "completed",
    archivedAt: null,
    createdAt: "x",
  },
];

const renderList = (
  props: Partial<React.ComponentProps<typeof ProjectList>> = {},
) =>
  render(
    <ThemeProvider theme={theme}>
      <ProjectList projects={projects} onEdit={vi.fn()} {...props} />
    </ThemeProvider>,
  );

describe("ProjectList", () => {
  it("renders an empty state when there are no projects", () => {
    renderList({ projects: [] });
    expect(screen.getByText(/no projects yet/i)).toBeDefined();
  });

  it("renders a card per project with its name, GC and status", () => {
    renderList();
    expect(screen.getByText("Downtown Highrise")).toBeDefined();
    expect(screen.getByText("Airport Expansion")).toBeDefined();
    expect(screen.getByText(/acme gc/i)).toBeDefined();
    expect(screen.getByText("active")).toBeDefined();
    expect(screen.getByText("completed")).toBeDefined();
  });

  it("calls onEdit with the project when its Edit button is clicked", () => {
    const onEdit = vi.fn();
    renderList({ onEdit });

    fireEvent.click(
      screen.getByRole("button", { name: /edit downtown highrise/i }),
    );
    expect(onEdit).toHaveBeenCalledWith(projects[0]);
  });

  it("shows an Archived badge instead of the status badge for an archived project", () => {
    renderList({
      projects: [{ ...projects[0], archivedAt: "2026-09-09T00:00:00.000Z" }],
    });
    expect(screen.getByText(/archived/i)).toBeDefined();
    expect(screen.queryByText("active")).toBeNull();
  });

  it("renders a dash when there are no GC details to show", () => {
    renderList({
      projects: [{ ...projects[0], gcCompanyId: null, gcNameCustom: null }],
    });

    expect(screen.getByText("GC: —")).toBeDefined();
  });
});
