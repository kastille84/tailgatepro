import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";

import {
  applyProjectPatch,
  findCachedProject,
  removeCachedProject,
  restoreProjectsQueries,
  snapshotProjectsQueries,
  upsertCachedProject,
} from "../../src/utils/optimisticProjects";
import type { Project } from "../../src/interfaces/project";

const project = (overrides: Partial<Project> = {}): Project => ({
  id: "project-1",
  ownerCompanyId: "company-1",
  name: "Site",
  gcCompanyId: null,
  gcNameCustom: "Acme GC",
  status: "active",
  archivedAt: null,
  createdAt: "2026-09-13T00:00:00.000Z",
  ...overrides,
});

describe("optimisticProjects", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
  });

  const seed = (includeArchived: boolean, data: Project[]) =>
    queryClient.setQueryData(["projects", { includeArchived }], data);

  describe("applyProjectPatch", () => {
    it("merges only the given fields, leaving the rest of the project alone", () => {
      const patched = applyProjectPatch(project(), {
        name: "New name",
        status: "completed",
        gcCompanyId: "gc-1",
        gcNameCustom: "New GC",
      });

      expect(patched).toEqual(
        project({
          name: "New name",
          status: "completed",
          gcCompanyId: "gc-1",
          gcNameCustom: "New GC",
        }),
      );
    });

    it("maps archived: true onto a stamped archivedAt", () => {
      const patched = applyProjectPatch(project(), { archived: true });
      expect(patched.archivedAt).not.toBeNull();
    });

    it("maps archived: false onto a null archivedAt", () => {
      const patched = applyProjectPatch(
        project({ archivedAt: "2026-09-13T00:00:00.000Z" }),
        { archived: false },
      );
      expect(patched.archivedAt).toBeNull();
    });

    it("leaves every field untouched when the patch is empty", () => {
      expect(applyProjectPatch(project(), {})).toEqual(project());
    });
  });

  describe("upsertCachedProject", () => {
    it("appends a new project to every seeded list when it's live", () => {
      seed(false, []);
      seed(true, []);

      upsertCachedProject(queryClient, project());

      expect(queryClient.getQueryData(["projects", { includeArchived: false }])).toEqual([
        project(),
      ]);
      expect(queryClient.getQueryData(["projects", { includeArchived: true }])).toEqual([
        project(),
      ]);
    });

    it("replaces an existing project with the same id in place, leaving others untouched", () => {
      const other = project({ id: "project-2", name: "Other site" });
      seed(true, [project({ name: "old name" }), other]);

      upsertCachedProject(queryClient, project({ name: "new name" }));

      expect(queryClient.getQueryData(["projects", { includeArchived: true }])).toEqual([
        project({ name: "new name" }),
        other,
      ]);
    });

    it("keeps an archived project out of the default (non-archived) view", () => {
      seed(false, []);
      seed(true, []);

      upsertCachedProject(
        queryClient,
        project({ archivedAt: "2026-09-13T01:00:00.000Z" }),
      );

      expect(
        queryClient.getQueryData(["projects", { includeArchived: false }]),
      ).toEqual([]);
      expect(
        queryClient.getQueryData(["projects", { includeArchived: true }]),
      ).toEqual([project({ archivedAt: "2026-09-13T01:00:00.000Z" })]);
    });

    it("removes a newly-archived project from the default view if it was there", () => {
      seed(false, [project()]);

      upsertCachedProject(
        queryClient,
        project({ archivedAt: "2026-09-13T01:00:00.000Z" }),
      );

      expect(
        queryClient.getQueryData(["projects", { includeArchived: false }]),
      ).toEqual([]);
    });

    it("leaves a query with no cached data (never fetched) untouched", () => {
      // includeArchived: true was never seeded/fetched in this session.
      seed(false, []);

      upsertCachedProject(queryClient, project());

      expect(
        queryClient.getQueryData(["projects", { includeArchived: true }]),
      ).toBeUndefined();
    });

    it("skips a query that exists in the cache but has no data yet (e.g. still loading)", () => {
      // A query can be registered (observed/pending) with undefined data,
      // distinct from a key that was never queried at all.
      queryClient.getQueryCache().build(queryClient, {
        queryKey: ["projects", { includeArchived: true }],
      });

      expect(() => upsertCachedProject(queryClient, project())).not.toThrow();
      expect(
        queryClient.getQueryData(["projects", { includeArchived: true }]),
      ).toBeUndefined();
    });
  });

  describe("removeCachedProject", () => {
    it("removes the project from every seeded list", () => {
      seed(false, [project()]);
      seed(true, [project()]);

      removeCachedProject(queryClient, "project-1");

      expect(
        queryClient.getQueryData(["projects", { includeArchived: false }]),
      ).toEqual([]);
      expect(
        queryClient.getQueryData(["projects", { includeArchived: true }]),
      ).toEqual([]);
    });

    it("skips a query that exists in the cache but has no data yet", () => {
      queryClient.getQueryCache().build(queryClient, {
        queryKey: ["projects", { includeArchived: true }],
      });

      expect(() =>
        removeCachedProject(queryClient, "project-1"),
      ).not.toThrow();
    });
  });

  describe("findCachedProject", () => {
    it("finds a project cached under any view", () => {
      seed(false, []);
      seed(true, [project()]);

      expect(findCachedProject(queryClient, "project-1")).toEqual(project());
    });

    it("returns undefined when no view has it cached", () => {
      seed(false, []);
      expect(findCachedProject(queryClient, "missing")).toBeUndefined();
    });
  });

  describe("snapshotProjectsQueries / restoreProjectsQueries", () => {
    it("restores every query to its snapshotted value", () => {
      seed(false, [project()]);
      const snapshot = snapshotProjectsQueries(queryClient);

      upsertCachedProject(queryClient, project({ name: "changed" }));
      expect(
        queryClient.getQueryData(["projects", { includeArchived: false }]),
      ).toEqual([project({ name: "changed" })]);

      restoreProjectsQueries(queryClient, snapshot);
      expect(
        queryClient.getQueryData(["projects", { includeArchived: false }]),
      ).toEqual([project()]);
    });
  });
});
