import { afterEach, describe, expect, it } from "vitest";

import { tailgateDb } from "../../../src/utils/db/tailgateDb";
import type { OutboxRow } from "../../../src/interfaces/sync";
import type { Project } from "../../../src/interfaces/project";
import type { Talk } from "../../../src/interfaces/talk";

const outboxRow: OutboxRow = {
  id: "row-1",
  entity: "project",
  entityId: "project-1",
  op: "create",
  payload: { id: "project-1", name: "123 Main St" },
  status: "pending",
  attempts: 0,
  lastError: null,
  createdAt: "2026-09-13T00:00:00.000Z",
  syncedAt: null,
};

const project: Project = {
  id: "project-1",
  ownerCompanyId: "company-1",
  name: "123 Main St",
  gcCompanyId: null,
  gcNameCustom: "Acme GC",
  status: "active",
  archivedAt: null,
  createdAt: "2026-09-13T00:00:00.000Z",
};

const talk: Talk = {
  id: "talk-1",
  slug: "fall-protection",
  title: "Fall Protection",
  tradeTag: "Roofing",
  tradeTags: ["Roofing"],
  content: "# Fall Protection",
  structured: null,
  attribution: null,
  isGlobal: true,
  companyId: null,
  createdAt: "2026-09-13T00:00:00.000Z",
};

afterEach(async () => {
  await Promise.all([
    tailgateDb.outbox.clear(),
    tailgateDb.projectsCache.clear(),
    tailgateDb.talksCache.clear(),
  ]);
});

describe("tailgateDb", () => {
  it("opens with the outbox, projectsCache, and talksCache tables", () => {
    expect(tailgateDb.tables.map((t) => t.name).sort()).toEqual([
      "outbox",
      "projectsCache",
      "talksCache",
    ]);
  });

  it("round-trips a row through the outbox table, keyed by id", async () => {
    await tailgateDb.outbox.add(outboxRow);

    expect(await tailgateDb.outbox.get("row-1")).toEqual(outboxRow);
  });

  it("finds outbox rows by the status index", async () => {
    await tailgateDb.outbox.bulkAdd([
      outboxRow,
      { ...outboxRow, id: "row-2", status: "synced" },
    ]);

    const pending = await tailgateDb.outbox
      .where("status")
      .equals("pending")
      .toArray();

    expect(pending.map((row) => row.id)).toEqual(["row-1"]);
  });

  it("orders outbox rows by createdAt for a flush", async () => {
    await tailgateDb.outbox.bulkAdd([
      { ...outboxRow, id: "row-2", createdAt: "2026-09-13T00:00:02.000Z" },
      { ...outboxRow, id: "row-1", createdAt: "2026-09-13T00:00:01.000Z" },
    ]);

    const ordered = await tailgateDb.outbox.orderBy("createdAt").toArray();

    expect(ordered.map((row) => row.id)).toEqual(["row-1", "row-2"]);
  });

  it("round-trips a row through the projectsCache table, keyed by id", async () => {
    await tailgateDb.projectsCache.put(project);

    expect(await tailgateDb.projectsCache.get("project-1")).toEqual(project);
  });

  it("filters cached projects down to the non-archived ones", async () => {
    // archivedAt is nullable and NOT indexed (IndexedDB keys can't be null),
    // so callers filter the small cached list in memory rather than query it.
    await tailgateDb.projectsCache.bulkPut([
      project,
      { ...project, id: "project-2", archivedAt: "2026-09-13T00:00:00.000Z" },
    ]);

    const all = await tailgateDb.projectsCache.toArray();
    const live = all.filter((p) => p.archivedAt === null);

    expect(live.map((p) => p.id)).toEqual(["project-1"]);
  });

  it("round-trips a row through the talksCache table, keyed by id", async () => {
    await tailgateDb.talksCache.put(talk);

    expect(await tailgateDb.talksCache.get("talk-1")).toEqual(talk);
  });

  it("finds cached talks by the tradeTag index", async () => {
    await tailgateDb.talksCache.bulkPut([
      talk,
      { ...talk, id: "talk-2", tradeTag: "Electrical" },
    ]);

    const roofing = await tailgateDb.talksCache
      .where("tradeTag")
      .equals("Roofing")
      .toArray();

    expect(roofing.map((t) => t.id)).toEqual(["talk-1"]);
  });
});
