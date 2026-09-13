import { afterEach, describe, expect, it, vi } from "vitest";

import {
  enqueueMutation,
  flush,
  getPendingCount,
  resetStuckSyncingRows,
} from "../../../src/utils/db/outbox";
import { tailgateDb } from "../../../src/utils/db/tailgateDb";
import type { OutboxRow } from "../../../src/interfaces/sync";

const setOnline = (value: boolean) => {
  Object.defineProperty(window.navigator, "onLine", {
    value,
    configurable: true,
  });
};

afterEach(async () => {
  await tailgateDb.outbox.clear();
  setOnline(true);
});

describe("enqueueMutation", () => {
  it("writes a pending row without a replayer", async () => {
    const row = await enqueueMutation({
      entity: "project",
      entityId: "project-1",
      op: "create",
      payload: { id: "project-1", name: "123 Main St" },
    });

    expect(row.status).toBe("pending");
    expect(row.attempts).toBe(0);
    expect(row.syncedAt).toBeNull();
    expect(await tailgateDb.outbox.get(row.id)).toEqual(row);
    expect(await getPendingCount()).toBe(1);
  });

  it("attempts an immediate flush when online and a replayer is given", async () => {
    const replay = vi.fn().mockResolvedValue(undefined);
    setOnline(true);

    const row = await enqueueMutation(
      { entity: "project", entityId: "project-1", op: "create", payload: {} },
      replay,
    );

    expect(replay).toHaveBeenCalledTimes(1);
    expect((await tailgateDb.outbox.get(row.id))?.status).toBe("synced");
    expect(await getPendingCount()).toBe(0);
  });

  it("does not flush when offline, even with a replayer", async () => {
    const replay = vi.fn().mockResolvedValue(undefined);
    setOnline(false);

    const row = await enqueueMutation(
      { entity: "project", entityId: "project-1", op: "create", payload: {} },
      replay,
    );

    expect(replay).not.toHaveBeenCalled();
    expect((await tailgateDb.outbox.get(row.id))?.status).toBe("pending");
  });
});

describe("flush", () => {
  it("marks a successfully replayed row synced and stamps syncedAt", async () => {
    const row = await enqueueMutation({
      entity: "project",
      entityId: "project-1",
      op: "update",
      payload: { name: "renamed" },
    });

    await flush(vi.fn().mockResolvedValue(undefined));

    const synced = await tailgateDb.outbox.get(row.id);
    expect(synced?.status).toBe("synced");
    expect(synced?.syncedAt).not.toBeNull();
  });

  it("marks a failed row failed, increments attempts, and keeps it retry-eligible", async () => {
    const row = await enqueueMutation({
      entity: "project",
      entityId: "project-1",
      op: "update",
      payload: {},
    });

    await flush(vi.fn().mockRejectedValue(new Error("network down")));

    const failed = await tailgateDb.outbox.get(row.id);
    expect(failed?.status).toBe("failed");
    expect(failed?.attempts).toBe(1);
    expect(failed?.lastError).toBe("network down");
    expect(await getPendingCount()).toBe(1); // still retry-eligible

    // A later flush retries it and can succeed.
    await flush(vi.fn().mockResolvedValue(undefined));
    expect((await tailgateDb.outbox.get(row.id))?.status).toBe("synced");
  });

  it("stores a stringified lastError when the replayer rejects with a non-Error", async () => {
    const row = await enqueueMutation({
      entity: "project",
      entityId: "project-1",
      op: "update",
      payload: {},
    });

    await flush(vi.fn().mockRejectedValue("plain string rejection"));

    expect((await tailgateDb.outbox.get(row.id))?.lastError).toBe(
      "plain string rejection",
    );
  });

  it("processes rows in createdAt order regardless of insertion order", async () => {
    const calls: string[] = [];
    const replay = vi.fn(async (row: OutboxRow) => {
      calls.push(row.id);
    });

    await tailgateDb.outbox.bulkAdd([
      {
        id: "second",
        entity: "project",
        entityId: "project-1",
        op: "update",
        payload: {},
        status: "pending",
        attempts: 0,
        lastError: null,
        createdAt: "2026-09-13T00:00:02.000Z",
        syncedAt: null,
      },
      {
        id: "first",
        entity: "project",
        entityId: "project-1",
        op: "create",
        payload: {},
        status: "pending",
        attempts: 0,
        lastError: null,
        createdAt: "2026-09-13T00:00:01.000Z",
        syncedAt: null,
      },
    ]);

    await flush(replay);

    expect(calls).toEqual(["first", "second"]);
  });

  it("stops an entity's chain after a failure without blocking other entities", async () => {
    const calls: string[] = [];
    const replay = vi.fn(async (row: OutboxRow) => {
      calls.push(row.id);
      if (row.id === "create-a") throw new Error("boom");
    });

    await tailgateDb.outbox.bulkAdd([
      {
        id: "create-a",
        entity: "project",
        entityId: "project-a",
        op: "create",
        payload: {},
        status: "pending",
        attempts: 0,
        lastError: null,
        createdAt: "2026-09-13T00:00:01.000Z",
        syncedAt: null,
      },
      {
        id: "update-a",
        entity: "project",
        entityId: "project-a",
        op: "update",
        payload: {},
        status: "pending",
        attempts: 0,
        lastError: null,
        createdAt: "2026-09-13T00:00:02.000Z",
        syncedAt: null,
      },
      {
        id: "create-b",
        entity: "project",
        entityId: "project-b",
        op: "create",
        payload: {},
        status: "pending",
        attempts: 0,
        lastError: null,
        createdAt: "2026-09-13T00:00:03.000Z",
        syncedAt: null,
      },
    ]);

    await flush(replay);

    // update-a was never attempted — it would apply on top of a create that
    // never landed — but create-b (a different entity) still went through.
    expect(calls).toEqual(["create-a", "create-b"]);
    expect((await tailgateDb.outbox.get("create-a"))?.status).toBe("failed");
    expect((await tailgateDb.outbox.get("update-a"))?.status).toBe("pending");
    expect((await tailgateDb.outbox.get("create-b"))?.status).toBe("synced");
  });

  it("is a no-op while a flush is already running", async () => {
    await enqueueMutation({
      entity: "project",
      entityId: "project-1",
      op: "create",
      payload: {},
    });

    let releaseFirst!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const firstReplay = vi.fn(() => gate);
    const secondReplay = vi.fn().mockResolvedValue(undefined);

    const firstFlush = flush(firstReplay);
    const secondFlush = flush(secondReplay); // should return immediately, no-op

    await secondFlush;
    expect(secondReplay).not.toHaveBeenCalled();

    releaseFirst();
    await firstFlush;
    expect(firstReplay).toHaveBeenCalledTimes(1);
  });
});

describe("resetStuckSyncingRows", () => {
  it("resets a row left syncing from a previous session back to pending", async () => {
    await tailgateDb.outbox.add({
      id: "stuck",
      entity: "project",
      entityId: "project-1",
      op: "update",
      payload: {},
      status: "syncing",
      attempts: 0,
      lastError: null,
      createdAt: "2026-09-13T00:00:00.000Z",
      syncedAt: null,
    });

    await resetStuckSyncingRows();

    expect((await tailgateDb.outbox.get("stuck"))?.status).toBe("pending");
  });

  it("leaves pending, failed, and synced rows untouched", async () => {
    await tailgateDb.outbox.bulkAdd([
      {
        id: "pending-row",
        entity: "project",
        entityId: "project-1",
        op: "create",
        payload: {},
        status: "pending",
        attempts: 0,
        lastError: null,
        createdAt: "2026-09-13T00:00:00.000Z",
        syncedAt: null,
      },
      {
        id: "synced-row",
        entity: "project",
        entityId: "project-2",
        op: "create",
        payload: {},
        status: "synced",
        attempts: 0,
        lastError: null,
        createdAt: "2026-09-13T00:00:00.000Z",
        syncedAt: "2026-09-13T00:00:01.000Z",
      },
    ]);

    await resetStuckSyncingRows();

    expect((await tailgateDb.outbox.get("pending-row"))?.status).toBe(
      "pending",
    );
    expect((await tailgateDb.outbox.get("synced-row"))?.status).toBe(
      "synced",
    );
  });
});

describe("getPendingCount", () => {
  it("counts pending and failed rows, but not syncing or synced ones", async () => {
    await tailgateDb.outbox.bulkAdd([
      {
        id: "a",
        entity: "project",
        entityId: "1",
        op: "create",
        payload: {},
        status: "pending",
        attempts: 0,
        lastError: null,
        createdAt: "2026-09-13T00:00:00.000Z",
        syncedAt: null,
      },
      {
        id: "b",
        entity: "project",
        entityId: "2",
        op: "update",
        payload: {},
        status: "failed",
        attempts: 1,
        lastError: "boom",
        createdAt: "2026-09-13T00:00:00.000Z",
        syncedAt: null,
      },
      {
        id: "c",
        entity: "project",
        entityId: "3",
        op: "delete",
        payload: {},
        status: "syncing",
        attempts: 0,
        lastError: null,
        createdAt: "2026-09-13T00:00:00.000Z",
        syncedAt: null,
      },
      {
        id: "d",
        entity: "project",
        entityId: "4",
        op: "archive",
        payload: {},
        status: "synced",
        attempts: 0,
        lastError: null,
        createdAt: "2026-09-13T00:00:00.000Z",
        syncedAt: "2026-09-13T00:00:01.000Z",
      },
    ]);

    expect(await getPendingCount()).toBe(2);
  });
});
