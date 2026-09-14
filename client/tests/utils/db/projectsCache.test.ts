import { afterEach, describe, expect, it } from "vitest";

import {
  cacheProjects,
  getCachedProjects,
} from "../../../src/utils/db/projectsCache";
import { tailgateDb } from "../../../src/utils/db/tailgateDb";
import type { Project } from "../../../src/interfaces/project";

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

afterEach(async () => {
  await tailgateDb.projectsCache.clear();
});

describe("cacheProjects", () => {
  it("writes the given projects into the cache", async () => {
    await cacheProjects([project()]);
    expect(await tailgateDb.projectsCache.get("project-1")).toEqual(
      project(),
    );
  });

  it("upserts rather than replacing the whole table", async () => {
    await cacheProjects([project()]);
    await cacheProjects([project({ id: "project-2", name: "Other site" })]);

    // Fetching one includeArchived view (project-2) doesn't wipe out a
    // project cached from the other view (project-1).
    expect(await tailgateDb.projectsCache.count()).toBe(2);
  });

  it("updates an existing cached project in place", async () => {
    await cacheProjects([project({ name: "old name" })]);
    await cacheProjects([project({ name: "new name" })]);

    expect((await tailgateDb.projectsCache.get("project-1"))?.name).toBe(
      "new name",
    );
  });

  it("is a no-op for an empty list", async () => {
    await cacheProjects([project()]);
    await cacheProjects([]);
    expect(await tailgateDb.projectsCache.count()).toBe(1);
  });
});

describe("getCachedProjects", () => {
  it("returns only non-archived projects by default", async () => {
    await tailgateDb.projectsCache.bulkPut([
      project(),
      project({ id: "project-2", archivedAt: "2026-09-13T01:00:00.000Z" }),
    ]);

    const result = await getCachedProjects(false);
    expect(result.map((p) => p.id)).toEqual(["project-1"]);
  });

  it("returns every cached project when includeArchived is true", async () => {
    await tailgateDb.projectsCache.bulkPut([
      project(),
      project({ id: "project-2", archivedAt: "2026-09-13T01:00:00.000Z" }),
    ]);

    const result = await getCachedProjects(true);
    expect(result.map((p) => p.id).sort()).toEqual(["project-1", "project-2"]);
  });

  it("returns an empty array when nothing is cached", async () => {
    expect(await getCachedProjects(false)).toEqual([]);
  });
});
