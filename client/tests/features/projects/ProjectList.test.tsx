import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { ProjectList } from "../../../src/features/projects";
import theme from "../../../src/styles/theme";
import type { Project } from "../../../src/interfaces/project";
import type { JobsiteMembership } from "../../../src/interfaces/jobsite";

vi.mock("../../../src/hooks/useSetMyCadence", () => ({
  useSetMyCadence: () => ({ setMyCadence: vi.fn(), isSaving: false }),
}));

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

/** Action buttons live in a collapsed-by-default panel; open every card's. */
const expandAll = () =>
  screen
    .getAllByRole("button", { name: /^actions for /i })
    .forEach((toggle) => fireEvent.click(toggle));

const membership: JobsiteMembership = {
  jobsiteId: "j1",
  jobsiteName: "Downtown Highrise",
  jobsiteCadence: "weekly",
  subCadence: null,
  effectiveCadence: "weekly",
};

describe("ProjectList", () => {
  it("shows a talk-cadence control on a live project linked to a job site with a membership", () => {
    renderList({
      projects: [{ ...projects[0], jobsiteId: "j1" }],
      cadenceByJobsiteId: new Map([["j1", membership]]),
    });

    expect(screen.getByLabelText("Talk cadence for Downtown Highrise")).toBeDefined();
  });

  it("shows no cadence control without a job site, without a membership, or when archived", () => {
    renderList({
      projects: [
        { ...projects[0], id: "a", jobsiteId: null },
        { ...projects[0], id: "b", jobsiteId: "other" },
        { ...projects[0], id: "c", jobsiteId: "j1", archivedAt: "2026-01-01T00:00:00.000Z" },
      ],
      cadenceByJobsiteId: new Map([["j1", membership]]),
    });

    expect(screen.queryByText("Talk cadence")).toBeNull();
  });

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

  it("keeps the action buttons collapsed until the card's toggle is opened", () => {
    renderList({ onLinkGc: vi.fn(), onManageIntegrations: vi.fn() });

    const toggle = screen.getAllByRole("button", {
      name: /^actions for downtown highrise/i,
    })[0];
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("button", { name: /edit downtown highrise/i })).toBeNull();

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const panel = document.getElementById(toggle.getAttribute("aria-controls") ?? "");
    expect(panel?.getAttribute("role")).toBe("group");
    expect(screen.getByRole("button", { name: /edit downtown highrise/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /integrations for downtown highrise/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /link to gc for downtown highrise/i })).toBeDefined();

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("button", { name: /edit downtown highrise/i })).toBeNull();
  });

  it("calls onEdit with the project when its Edit button is clicked", () => {
    const onEdit = vi.fn();
    renderList({ onEdit });
    expandAll();

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
      expandAll();

      expect(screen.queryByRole("button", { name: /link to gc/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /unlink gc/i })).toBeNull();
    });

    it("offers 'Link to GC' for an unlinked project and reports it", () => {
      const onLinkGc = vi.fn();
      renderList({ onLinkGc });
      expandAll();

      fireEvent.click(
        screen.getByRole("button", { name: /link to gc for downtown highrise/i }),
      );

      expect(onLinkGc).toHaveBeenCalledWith(projects[0]);
    });

    it("offers 'Unlink GC' instead for a project already linked to a GC", () => {
      const onLinkGc = vi.fn();
      const linked = { ...projects[0], gcCompanyId: "gc-1" };
      renderList({ projects: [linked], onLinkGc });
      expandAll();

      expect(screen.queryByRole("button", { name: /^link to gc/i })).toBeNull();
      fireEvent.click(
        screen.getByRole("button", { name: /unlink gc for downtown highrise/i }),
      );

      expect(onLinkGc).toHaveBeenCalledWith(linked);
    });

    it("disables the link action, with a visible reason, while the project's create is still queued", () => {
      const onLinkGc = vi.fn();
      renderList({
        onLinkGc,
        unsyncedProjectIds: new Set(["p1"]),
      });
expandAll();

      const queued = screen.getByRole("button", {
        name: /link to gc for downtown highrise/i,
      }) as HTMLButtonElement;
      expect(queued.disabled).toBe(true);
      expect(queued.getAttribute("aria-describedby")).toBe("unsynced-p1");
      expect(document.getElementById("unsynced-p1")?.textContent).toMatch(
        /syncing/i,
      );
      fireEvent.click(queued);
      expect(onLinkGc).not.toHaveBeenCalled();

      const synced = screen.getByRole("button", {
        name: /link to gc for airport expansion/i,
      }) as HTMLButtonElement;
      expect(synced.disabled).toBe(false);
      expect(synced.getAttribute("aria-describedby")).toBeNull();
    });

    it("shows no syncing hint when there is no link action to disable", () => {
      renderList({ unsyncedProjectIds: new Set(["p1"]) });

      expect(screen.queryByText(/syncing/i)).toBeNull();
    });

    it("hides the link action for an archived project", () => {
      renderList({
        projects: [{ ...projects[0], archivedAt: "2026-09-09T00:00:00.000Z" }],
        onLinkGc: vi.fn(),
      });
expandAll();

      expect(screen.queryByRole("button", { name: /link to gc/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /unlink gc/i })).toBeNull();
    });
  });

  describe("Integrations action", () => {
    it("shows no integrations action when the page does not pass onManageIntegrations", () => {
      renderList();
      expandAll();

      expect(screen.queryByRole("button", { name: /integrations for/i })).toBeNull();
    });

    it("reports the project when its Integrations button is clicked", () => {
      const onManageIntegrations = vi.fn();
      renderList({ onManageIntegrations });
      expandAll();

      fireEvent.click(
        screen.getByRole("button", { name: /integrations for downtown highrise/i }),
      );

      expect(onManageIntegrations).toHaveBeenCalledWith(projects[0]);
    });

    it("disables it, with a visible reason, while the project's create is still queued", () => {
      const onManageIntegrations = vi.fn();
      renderList({ onManageIntegrations, unsyncedProjectIds: new Set(["p1"]) });
      expandAll();

      const queued = screen.getByRole("button", {
        name: /integrations for downtown highrise/i,
      }) as HTMLButtonElement;
      expect(queued.disabled).toBe(true);
      expect(queued.getAttribute("aria-describedby")).toBe("unsynced-p1");
      fireEvent.click(queued);
      expect(onManageIntegrations).not.toHaveBeenCalled();

      const synced = screen.getByRole("button", {
        name: /integrations for airport expansion/i,
      }) as HTMLButtonElement;
      expect(synced.disabled).toBe(false);
      expect(synced.getAttribute("aria-describedby")).toBeNull();
    });

    it("hides it for an archived project", () => {
      renderList({
        projects: [{ ...projects[0], archivedAt: "2026-09-09T00:00:00.000Z" }],
        onManageIntegrations: vi.fn(),
      });
expandAll();

      expect(screen.queryByRole("button", { name: /integrations for/i })).toBeNull();
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
