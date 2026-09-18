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
    expect(await tailgateDb.outbox.get(row.id)).toBeUndefined(); // deleted once synced
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

  it("rejects and discards the row when its first, online attempt fails", async () => {
    const replay = vi
      .fn()
      .mockRejectedValue(new Error("A general contractor is required"));
    setOnline(true);

    await expect(
      enqueueMutation(
        { entity: "project", entityId: "project-1", op: "create", payload: {} },
        replay,
      ),
    ).rejects.toThrow("A general contractor is required");

    expect(await tailgateDb.outbox.count()).toBe(0); // discarded, not requeued
    expect(await getPendingCount()).toBe(0);
  });

  it("does not discard or reject when the first, online attempt fails with a network error", async () => {
    // A TypeError is what fetch() itself rejects with on a genuine network
    // failure — distinct from the Error apiProjects.ts throws once a
    // response is actually received. This should behave like being offline:
    // stay queued, resolve normally — not like an invalid payload.
    const replay = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    setOnline(true);

    const row = await enqueueMutation(
      { entity: "project", entityId: "project-1", op: "create", payload: {} },
      replay,
    );

    const stored = await tailgateDb.outbox.get(row.id);
    expect(stored?.status).toBe("failed");
    expect(stored?.attempts).toBe(1);
    expect(await getPendingCount()).toBe(1);
  });

  it("does not discard or reject when the first, online attempt times out", async () => {
    // fetchWithTimeout rejects with an error named "AbortError" on timeout.
    const timeoutError = Object.assign(new Error("The operation was aborted."), {
      name: "AbortError",
    });
    const replay = vi.fn().mockRejectedValue(timeoutError);
    setOnline(true);

    const row = await enqueueMutation(
      { entity: "project", entityId: "project-1", op: "create", payload: {} },
      replay,
    );

    const stored = await tailgateDb.outbox.get(row.id);
    expect(stored?.status).toBe("failed");
    expect(stored?.attempts).toBe(1);
    expect(await getPendingCount()).toBe(1);
  });

  it("does not reject when an earlier unsynced row for the same entity already exists — it just joins the queue", async () => {
    // No replayer on this first call, so it stays pending without attempting.
    await enqueueMutation({
      entity: "project",
      entityId: "project-1",
      op: "update",
      payload: { name: "first" },
    });
    const replay = vi.fn().mockResolvedValue(undefined);

    const row = await enqueueMutation(
      {
        entity: "project",
        entityId: "project-1",
        op: "update",
        payload: { name: "second" },
      },
      replay,
    );

    // Both rows flushed, in order, once the chain was clear to run.
    expect(replay).toHaveBeenCalledTimes(2);
    expect(await tailgateDb.outbox.get(row.id)).toBeUndefined(); // deleted once synced
    expect(await getPendingCount()).toBe(0);
  });

  it("rejects with a TimeoutError instead of hanging forever when the local write never settles", async () => {
    // Simulates a blocked/stuck IndexedDB connection (e.g. another open tab)
    // — the write itself is what hangs here, before any network is involved.
    vi.useFakeTimers();
    const addSpy = vi
      .spyOn(tailgateDb.outbox, "add")
      .mockReturnValue(new Promise(() => {}) as never);

    const promise = enqueueMutation({
      entity: "project",
      entityId: "project-1",
      op: "create",
      payload: {},
    });
    const assertion = expect(promise).rejects.toMatchObject({
      name: "TimeoutError",
    });

    await vi.advanceTimersByTimeAsync(5000);
    await assertion;

    addSpy.mockRestore();
    vi.useRealTimers();
  });

  it("includes dependsOnEntityIds on the row when given", async () => {
    const row = await enqueueMutation({
      entity: "signature",
      entityId: "signature-1",
      op: "create",
      payload: {},
      dependsOnEntityIds: ["meeting-1"],
    });

    expect(row.dependsOnEntityIds).toEqual(["meeting-1"]);
    expect((await tailgateDb.outbox.get(row.id))?.dependsOnEntityIds).toEqual([
      "meeting-1",
    ]);
  });

  it("omits dependsOnEntityIds from the row when given an empty array", async () => {
    const row = await enqueueMutation({
      entity: "meeting_completion",
      entityId: "meeting-1",
      op: "complete",
      payload: {},
      dependsOnEntityIds: [],
    });

    expect(row.dependsOnEntityIds).toBeUndefined();
  });
});

describe("flush", () => {
  it("deletes a successfully replayed row rather than keeping it marked synced", async () => {
    const row = await enqueueMutation({
      entity: "project",
      entityId: "project-1",
      op: "update",
      payload: { name: "renamed" },
    });

    await flush(vi.fn().mockResolvedValue(undefined));

    expect(await tailgateDb.outbox.get(row.id)).toBeUndefined();
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
    expect(await tailgateDb.outbox.get(row.id)).toBeUndefined(); // deleted once synced
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
    expect(await tailgateDb.outbox.get("create-b")).toBeUndefined(); // deleted once synced
  });

  it("watchRowId only rethrows on a row's first attempt — a later failure stays silent and retry-eligible", async () => {
    await tailgateDb.outbox.add({
      id: "watched",
      entity: "project",
      entityId: "project-1",
      op: "update",
      payload: {},
      status: "failed",
      attempts: 1, // already failed once before
      lastError: "previous error",
      createdAt: "2026-09-13T00:00:00.000Z",
      syncedAt: null,
    });

    await expect(
      flush(vi.fn().mockRejectedValue(new Error("still down")), {
        watchRowId: "watched",
      }),
    ).resolves.toBeUndefined();

    const row = await tailgateDb.outbox.get("watched");
    expect(row?.status).toBe("failed");
    expect(row?.attempts).toBe(2);
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

  it("rejects with a TimeoutError instead of hanging when a status update never settles", async () => {
    await enqueueMutation({
      entity: "project",
      entityId: "project-1",
      op: "create",
      payload: {},
    });

    vi.useFakeTimers();
    const updateSpy = vi
      .spyOn(tailgateDb.outbox, "update")
      .mockReturnValue(new Promise(() => {}) as never);

    const promise = flush(vi.fn().mockResolvedValue(undefined));
    const assertion = expect(promise).rejects.toMatchObject({
      name: "TimeoutError",
    });

    await vi.advanceTimersByTimeAsync(5000);
    await assertion;

    updateSpy.mockRestore();
    vi.useRealTimers();
  });
});

describe("flush — dependsOnEntityIds", () => {
  it("skips a row whose dependency is still in the outbox, leaving it pending", async () => {
    const calls: string[] = [];
    const replay = vi.fn(async (row: OutboxRow) => {
      calls.push(row.id);
      throw new Error("dependency never synced in this pass");
    });

    await tailgateDb.outbox.bulkAdd([
      {
        id: "meeting-create",
        entity: "meeting_log",
        entityId: "meeting-1",
        op: "create",
        payload: {},
        status: "pending",
        attempts: 0,
        lastError: null,
        createdAt: "2026-09-15T00:00:01.000Z",
        syncedAt: null,
      },
      {
        id: "signature-create",
        entity: "signature",
        entityId: "signature-1",
        op: "create",
        payload: {},
        status: "pending",
        attempts: 0,
        lastError: null,
        createdAt: "2026-09-15T00:00:02.000Z",
        syncedAt: null,
        dependsOnEntityIds: ["meeting-1"],
      },
    ]);

    await flush(replay);

    // The meeting-log row was attempted (and failed); the dependent
    // signature row was never attempted at all.
    expect(calls).toEqual(["meeting-create"]);
    expect((await tailgateDb.outbox.get("signature-create"))?.status).toBe(
      "pending",
    );
  });

  it("attempts a dependent row once its dependency has synced, in the same pass", async () => {
    const calls: string[] = [];
    const replay = vi.fn(async (row: OutboxRow) => {
      calls.push(row.id);
    });

    await tailgateDb.outbox.bulkAdd([
      {
        id: "meeting-create",
        entity: "meeting_log",
        entityId: "meeting-1",
        op: "create",
        payload: {},
        status: "pending",
        attempts: 0,
        lastError: null,
        createdAt: "2026-09-15T00:00:01.000Z",
        syncedAt: null,
      },
      {
        id: "signature-create",
        entity: "signature",
        entityId: "signature-1",
        op: "create",
        payload: {},
        status: "pending",
        attempts: 0,
        lastError: null,
        createdAt: "2026-09-15T00:00:02.000Z",
        syncedAt: null,
        dependsOnEntityIds: ["meeting-1"],
      },
    ]);

    await flush(replay);

    // The meeting-log row synced (deleted) before the signature row was
    // reached, so its dependency check finds nothing outstanding.
    expect(calls).toEqual(["meeting-create", "signature-create"]);
    expect(await tailgateDb.outbox.get("signature-create")).toBeUndefined();
  });

  it("cascades an unresolved dependency to a later same-entityId row, without marking either row failed", async () => {
    const calls: string[] = [];
    const replay = vi.fn(async (row: OutboxRow) => {
      calls.push(row.id);
      if (row.id === "meeting-create") throw new Error("boom");
    });

    await tailgateDb.outbox.bulkAdd([
      {
        id: "meeting-create",
        entity: "meeting_log",
        entityId: "meeting-1",
        op: "create",
        payload: {},
        status: "pending",
        attempts: 0,
        lastError: null,
        createdAt: "2026-09-15T00:00:01.000Z",
        syncedAt: null,
      },
      {
        id: "signature-create",
        entity: "signature",
        entityId: "signature-1",
        op: "create",
        payload: {},
        status: "pending",
        attempts: 0,
        lastError: null,
        createdAt: "2026-09-15T00:00:02.000Z",
        syncedAt: null,
        dependsOnEntityIds: ["meeting-1"],
      },
      {
        // Chained to signature-create via the ordinary same-entityId
        // mechanism (a signature blob upload) — must not slip through just
        // because the create row was skipped rather than failed.
        id: "signature-blob",
        entity: "signature",
        entityId: "signature-1",
        op: "update",
        payload: {},
        status: "pending",
        attempts: 0,
        lastError: null,
        createdAt: "2026-09-15T00:00:03.000Z",
        syncedAt: null,
      },
    ]);

    await flush(replay);

    expect(calls).toEqual(["meeting-create"]);
    expect((await tailgateDb.outbox.get("meeting-create"))?.status).toBe(
      "failed",
    );
    expect((await tailgateDb.outbox.get("signature-create"))?.status).toBe(
      "pending",
    );
    expect((await tailgateDb.outbox.get("signature-blob"))?.status).toBe(
      "pending",
    );
  });

  it("skips a row with two dependencies when only one has cleared", async () => {
    const calls: string[] = [];
    const replay = vi.fn(async (row: OutboxRow) => {
      calls.push(row.id);
      // signature-b's create fails again this pass, so it's still
      // outstanding by the time the completion row is reached.
      if (row.id === "signature-b-create") throw new Error("still down");
    });

    await tailgateDb.outbox.bulkAdd([
      {
        id: "signature-a-create",
        entity: "signature",
        entityId: "signature-a",
        op: "create",
        payload: {},
        status: "pending",
        attempts: 0,
        lastError: null,
        createdAt: "2026-09-17T00:00:01.000Z",
        syncedAt: null,
      },
      {
        id: "signature-b-create",
        entity: "signature",
        entityId: "signature-b",
        op: "create",
        payload: {},
        status: "failed",
        attempts: 3,
        lastError: "still down",
        createdAt: "2026-09-17T00:00:02.000Z",
        syncedAt: null,
      },
      {
        id: "meeting-complete",
        entity: "meeting_completion",
        entityId: "meeting-1",
        op: "complete",
        payload: {},
        status: "pending",
        attempts: 0,
        lastError: null,
        createdAt: "2026-09-17T00:00:03.000Z",
        syncedAt: null,
        dependsOnEntityIds: ["signature-a", "signature-b"],
      },
    ]);

    await flush(replay);

    // signature-a's create synced; signature-b's failed again this pass, so
    // the completion row is still blocked on it and never attempted.
    expect(calls).toEqual(["signature-a-create", "signature-b-create"]);
    expect((await tailgateDb.outbox.get("meeting-complete"))?.status).toBe(
      "pending",
    );
  });

  it("attempts a row with two dependencies once both have cleared", async () => {
    const calls: string[] = [];
    const replay = vi.fn(async (row: OutboxRow) => {
      calls.push(row.id);
    });

    await tailgateDb.outbox.bulkAdd([
      {
        id: "signature-a-create",
        entity: "signature",
        entityId: "signature-a",
        op: "create",
        payload: {},
        status: "pending",
        attempts: 0,
        lastError: null,
        createdAt: "2026-09-17T00:00:01.000Z",
        syncedAt: null,
      },
      {
        id: "signature-b-create",
        entity: "signature",
        entityId: "signature-b",
        op: "create",
        payload: {},
        status: "pending",
        attempts: 0,
        lastError: null,
        createdAt: "2026-09-17T00:00:02.000Z",
        syncedAt: null,
      },
      {
        id: "meeting-complete",
        entity: "meeting_completion",
        entityId: "meeting-1",
        op: "complete",
        payload: {},
        status: "pending",
        attempts: 0,
        lastError: null,
        createdAt: "2026-09-17T00:00:03.000Z",
        syncedAt: null,
        dependsOnEntityIds: ["signature-a", "signature-b"],
      },
    ]);

    await flush(replay);

    expect(calls).toEqual([
      "signature-a-create",
      "signature-b-create",
      "meeting-complete",
    ]);
    expect(await tailgateDb.outbox.get("meeting-complete")).toBeUndefined();
  });

  it("does not affect a row with no dependsOnEntityIds (Projects/Talks regression)", async () => {
    const calls: string[] = [];
    const replay = vi.fn(async (row: OutboxRow) => {
      calls.push(row.id);
    });

    await tailgateDb.outbox.bulkAdd([
      {
        id: "project-create",
        entity: "project",
        entityId: "project-1",
        op: "create",
        payload: {},
        status: "pending",
        attempts: 0,
        lastError: null,
        createdAt: "2026-09-15T00:00:01.000Z",
        syncedAt: null,
      },
      {
        id: "talk-create",
        entity: "talk",
        entityId: "talk-1",
        op: "create",
        payload: {},
        status: "pending",
        attempts: 0,
        lastError: null,
        createdAt: "2026-09-15T00:00:02.000Z",
        syncedAt: null,
      },
    ]);

    await flush(replay);

    expect(calls).toEqual(["project-create", "talk-create"]);
  });
});

describe("flush — already-exists 409", () => {
  it("deletes (rather than fails) a create row whose replay rejects with an 'already exists' message", async () => {
    const row = await enqueueMutation({
      entity: "meeting_log",
      entityId: "meeting-1",
      op: "create",
      payload: {},
    });

    await flush(
      vi.fn().mockRejectedValue(new Error("This meeting already exists")),
    );

    expect(await tailgateDb.outbox.get(row.id)).toBeUndefined();
    expect(await getPendingCount()).toBe(0);
  });

  it("resolves rather than rejects when the already-exists row is the watched row", async () => {
    const replay = vi
      .fn()
      .mockRejectedValue(new Error("This signature already exists"));
    setOnline(true);

    const row = await enqueueMutation(
      { entity: "signature", entityId: "signature-1", op: "create", payload: {} },
      replay,
    );

    expect(await tailgateDb.outbox.get(row.id)).toBeUndefined();
  });

  it("does not treat an 'already exists' message as synced on a non-create op", async () => {
    const row = await enqueueMutation({
      entity: "signature",
      entityId: "signature-1",
      op: "update",
      payload: {},
    });

    await flush(
      vi.fn().mockRejectedValue(new Error("This signature already exists")),
    );

    const stored = await tailgateDb.outbox.get(row.id);
    expect(stored?.status).toBe("failed");
  });

  it("does not treat a differently-worded 409 as synced", async () => {
    const row = await enqueueMutation({
      entity: "meeting_log",
      entityId: "meeting-1",
      op: "create",
      payload: {},
    });

    await flush(
      vi
        .fn()
        .mockRejectedValue(
          new Error(
            "This meeting has already been completed and can't be changed.",
          ),
        ),
    );

    const stored = await tailgateDb.outbox.get(row.id);
    expect(stored?.status).toBe("failed");
  });
});

describe("flush — already-completed 409", () => {
  it("deletes (rather than fails) a complete row whose replay rejects with an 'already been completed' message", async () => {
    const row = await enqueueMutation({
      entity: "meeting_completion",
      entityId: "meeting-1",
      op: "complete",
      payload: {},
    });

    await flush(
      vi
        .fn()
        .mockRejectedValue(
          new Error(
            "This meeting has already been completed and can't be changed.",
          ),
        ),
    );

    expect(await tailgateDb.outbox.get(row.id)).toBeUndefined();
    expect(await getPendingCount()).toBe(0);
  });

  it("resolves rather than rejects when the already-completed row is the watched row", async () => {
    const replay = vi
      .fn()
      .mockRejectedValue(
        new Error(
          "This meeting has already been completed and can't be changed.",
        ),
      );
    setOnline(true);

    const row = await enqueueMutation(
      {
        entity: "meeting_completion",
        entityId: "meeting-1",
        op: "complete",
        payload: {},
      },
      replay,
    );

    expect(await tailgateDb.outbox.get(row.id)).toBeUndefined();
  });

  it("does not treat an 'already been completed' message as synced on a non-complete op", async () => {
    const row = await enqueueMutation({
      entity: "meeting_log",
      entityId: "meeting-1",
      op: "update",
      payload: {},
    });

    await flush(
      vi
        .fn()
        .mockRejectedValue(
          new Error(
            "This meeting has already been completed and can't be changed.",
          ),
        ),
    );

    const stored = await tailgateDb.outbox.get(row.id);
    expect(stored?.status).toBe("failed");
  });

  it("does not treat a differently-worded 409 as synced", async () => {
    const row = await enqueueMutation({
      entity: "meeting_completion",
      entityId: "meeting-1",
      op: "complete",
      payload: {},
    });

    await flush(
      vi
        .fn()
        .mockRejectedValue(
          new Error(
            "A meeting needs at least one signature before it can be completed.",
          ),
        ),
    );

    const stored = await tailgateDb.outbox.get(row.id);
    expect(stored?.status).toBe("failed");
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
