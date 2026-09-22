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

  it("shows the GC's name and a linked badge for a project linked to a GC", () => {
    renderList({
      projects: [
        { ...projects[0], gcCompanyId: "gc-1", gcNameCustom: "Big GC" },
      ],
    });

    expect(screen.getByText("GC: Big GC")).toBeDefined();
    expect(screen.getByText("GC linked")).toBeDefined();
  });

  it("shows no linked badge for a project that is not linked", () => {
    renderList();
    expect(screen.queryByText("GC linked")).toBeNull();
  });

  describe("GC link action", () => {
    it("shows no link action when the page does not pass onLinkGc", () => {
      renderList();

      expect(screen.queryByRole("button", { name: /link to gc/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /unlink gc/i })).toBeNull();
    });

    it("offers 'Link to GC' for an unlinked project and reports it", () => {
      const onLinkGc = vi.fn();
      renderList({ onLinkGc });

      fireEvent.click(
        screen.getByRole("button", { name: /link to gc for downtown highrise/i }),
      );

      expect(onLinkGc).toHaveBeenCalledWith(projects[0]);
    });

    it("offers 'Unlink GC' instead for a project already linked to a GC", () => {
      const onLinkGc = vi.fn();
      const linked = { ...projects[0], gcCompanyId: "gc-1" };
      renderList({ projects: [linked], onLinkGc });

      expect(screen.queryByRole("button", { name: /^link to gc/i })).toBeNull();
      fireEvent.click(
        screen.getByRole("button", { name: /unlink gc for downtown highrise/i }),
      );

      expect(onLinkGc).toHaveBeenCalledWith(linked);
    });

    it("hides the link action for an archived project", () => {
      renderList({
        projects: [{ ...projects[0], archivedAt: "2026-09-09T00:00:00.000Z" }],
        onLinkGc: vi.fn(),
      });

      expect(screen.queryByRole("button", { name: /link to gc/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /unlink gc/i })).toBeNull();
    });
  });

  it("never falls back to showing the raw GC company id", () => {
    renderList({
      projects: [
        { ...projects[0], gcCompanyId: "gc-uuid-123", gcNameCustom: null },
      ],
    });

    expect(screen.getByText("GC: —")).toBeDefined();
    expect(screen.queryByText(/gc-uuid-123/)).toBeNull();
  });
});
