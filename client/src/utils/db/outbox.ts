import { tailgateDb } from "./tailgateDb";
import type { OutboxRow, SyncEntity, SyncOp } from "../../interfaces/sync";

/** What `enqueueMutation` needs to create a new outbox row. */
export interface EnqueueInput {
  entity: SyncEntity;
  entityId: string;
  op: SyncOp;
  payload: Record<string, unknown>;
}

/**
 * Replays one outbox row against the real API. Supplied by the caller rather
 * than imported here, so this module has no React/auth dependency and stays
 * easy to unit-test with a fake. The concrete replayer — built from the
 * current session's access token and `services/apiProjects` — is wired up
 * where the Projects hooks are retrofitted through the queue.
 */
export type Replayer = (row: OutboxRow) => Promise<void>;

const RETRYABLE_STATUSES = ["pending", "failed"] as const;

let isFlushing = false;

/**
 * Queues a mutation in the outbox, then — if a replayer is given and the
 * browser is online — attempts to flush immediately, so a connected user
 * sees no added latency versus calling the API directly. Offline, or with no
 * replayer, the row just sits `pending` until something else flushes it.
 */
export const enqueueMutation = async (
  input: EnqueueInput,
  replay?: Replayer,
): Promise<OutboxRow> => {
  const row: OutboxRow = {
    id: crypto.randomUUID(),
    entity: input.entity,
    entityId: input.entityId,
    op: input.op,
    payload: input.payload,
    status: "pending",
    attempts: 0,
    lastError: null,
    createdAt: new Date().toISOString(),
    syncedAt: null,
  };

  await tailgateDb.outbox.add(row);

  if (replay && navigator.onLine) {
    await flush(replay);
  }

  return row;
};

/** Rows still waiting to sync: `pending` (never tried, or requeued after a
 *  failure) and `failed` (tried and errored, retried on the next flush).
 *  Drives the offline indicator's badge count. */
export const getPendingCount = async (): Promise<number> =>
  tailgateDb.outbox.where("status").anyOf(RETRYABLE_STATUSES).count();

/** A row left `syncing` was mid-request when the app closed and is stale —
 *  reset it to `pending` so the next flush retries it. Call once at app
 *  boot, before the first `flush`. */
export const resetStuckSyncingRows = async (): Promise<void> => {
  await tailgateDb.outbox
    .where("status")
    .equals("syncing")
    .modify({ status: "pending" });
};

/**
 * Replays every retry-eligible row against the API, in `createdAt` order,
 * one `entityId` at a time — a `create` must land before a later `update` to
 * the same record. If a row fails, the rest of that entity's chain is left
 * alone (so an edit never applies on top of a create that never landed), but
 * other entities keep processing. See `docs/offline-sync-design.md`.
 *
 * A no-op if a flush is already running, so an `online` event, app boot, and
 * a manual "Retry now" click can't process the same row twice concurrently.
 */
export const flush = async (replay: Replayer): Promise<void> => {
  if (isFlushing) return;
  isFlushing = true;

  try {
    const rows = await tailgateDb.outbox
      .where("status")
      .anyOf(RETRYABLE_STATUSES)
      .sortBy("createdAt");

    const poisonedEntityIds = new Set<string>();

    for (const row of rows) {
      if (poisonedEntityIds.has(row.entityId)) continue;

      await tailgateDb.outbox.update(row.id, { status: "syncing" });

      try {
        await replay(row);
        await tailgateDb.outbox.update(row.id, {
          status: "synced",
          syncedAt: new Date().toISOString(),
        });
      } catch (error) {
        poisonedEntityIds.add(row.entityId);
        await tailgateDb.outbox.update(row.id, {
          status: "failed",
          attempts: row.attempts + 1,
          lastError: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } finally {
    isFlushing = false;
  }
};
