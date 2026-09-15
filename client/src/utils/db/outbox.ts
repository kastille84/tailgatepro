import { tailgateDb } from "./tailgateDb";
import { withTimeout } from "../withTimeout";
import type { OutboxRow, SyncEntity, SyncOp } from "../../interfaces/sync";

// Legitimate IndexedDB latency is never in the multi-second range under
// normal conditions — if a write hasn't resolved by this long, treat it as
// stuck (e.g. a connection blocked by another open tab) rather than hang the
// caller forever. See docs/offline-sync-design.md's addenda.
const DEXIE_WRITE_TIMEOUT_MS = 5_000;

/** What `enqueueMutation` needs to create a new outbox row. */
export interface EnqueueInput {
  entity: SyncEntity;
  entityId: string;
  op: SyncOp;
  payload: Record<string, unknown>;
  /** See `OutboxRow.dependsOnEntityId`. */
  dependsOnEntityId?: string;
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
 * True for a fetch-level failure — the request never got a response from the
 * server — as opposed to "the server responded and said no" (the plain
 * `Error` `apiProjects.ts` throws only after a response is actually
 * received). Per the Fetch spec, a genuine network failure rejects with a
 * `TypeError`; `fetchWithTimeout`'s abort-on-timeout rejects with something
 * named `"AbortError"`. Both should behave like being offline — stay queued,
 * no discard — not like an invalid payload the server explicitly rejected.
 */
const isNetworkOrTimeoutError = (error: unknown): boolean =>
  error instanceof TypeError ||
  (typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "AbortError");

/**
 * True for the one case the server signals via `AppError("This X already
 * exists", 409)` on a `create`'s Postgres `23505` unique-violation — see the
 * `create` functions in `projects.js`/`talks.js`/`meetingLogs.js`/
 * `signatures.js`. Means this row's write actually landed on an earlier
 * attempt (e.g. the response to that attempt was lost, or a previous flush
 * was interrupted after the server committed it), so the retry should be
 * treated as a success, not failed forever.
 *
 * Detected by message text rather than a status code: the server's JSON
 * error envelope only ever carries `{ success, error: <message> }` (see
 * `server/middlewares/errorHandler.js`), and `apiProjects.ts`/`apiTalks.ts`
 * already throw a plain `Error(body.error)` — matching text here keeps every
 * existing API wrapper unchanged instead of requiring a status-carrying
 * error class for no behavioral gain. Gated on `row.op === "create"` since
 * that's the only op this situation can happen for, and defensively — no
 * *other* 409 in the codebase (e.g. "already been completed", "used in a
 * logged safety talk") contains the phrase "already exists".
 */
const isAlreadyExistsError = (row: OutboxRow, error: unknown): boolean =>
  row.op === "create" &&
  error instanceof Error &&
  /already exists/i.test(error.message);

/**
 * Queues a mutation in the outbox, then — if a replayer is given and the
 * browser is online — attempts to flush immediately, so a connected user
 * sees no added latency versus calling the API directly. Offline, or with no
 * replayer, the row just sits `pending` until something else flushes it.
 *
 * That immediate attempt is "watched" (see `flush`'s `watchRowId`): if it's
 * this row's first try and the server responds with a rejection, the row is
 * discarded rather than kept for retry, and the error is rethrown here — a
 * synchronous, online mutation gets the same immediate rejection a direct
 * API call always gave, so a form can show the real validation error and
 * stay open instead of silently queuing a payload (e.g. a duplicate name)
 * that could never succeed anyway. A network-level failure or timeout (no
 * response was ever received — see `isNetworkOrTimeoutError`) is treated
 * like being offline instead: it stays queued and resolves normally, since
 * that's not a signal the payload itself was invalid.
 *
 * The initial write to the outbox itself is bounded too (`DEXIE_WRITE_TIMEOUT_MS`):
 * unlike a failed network request, a stuck local write has no queue to fall
 * back to, so it rejects for real rather than resolving quietly — there's
 * nowhere else to durably store the change.
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
    ...(input.dependsOnEntityId
      ? { dependsOnEntityId: input.dependsOnEntityId }
      : {}),
  };

  await withTimeout(
    tailgateDb.outbox.add(row),
    DEXIE_WRITE_TIMEOUT_MS,
    "Couldn't save your change locally — try again.",
  );

  if (replay && navigator.onLine) {
    await flush(replay, { watchRowId: row.id });
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

export interface FlushOptions {
  /**
   * If given, and this row is reached during the flush: on success it's
   * deleted as usual; on a server-rejected failure, if this was its very
   * first attempt (`attempts === 0`), the row is deleted (without ever
   * having synced) instead of requeued, and the error is thrown out of
   * `flush` (every other row still processes normally, failures and all). A
   * network/timeout failure never triggers this discard-and-rethrow, even on
   * a first attempt — see `isNetworkOrTimeoutError`. A later attempt on a
   * watched row that's already failed once behaves like any other row —
   * fails silently, stays queued — since whoever wanted an immediate answer
   * already got one. See `enqueueMutation`, the only caller that sets this.
   */
  watchRowId?: string;
}

/**
 * Replays every retry-eligible row against the API, in `createdAt` order,
 * one `entityId` at a time — a `create` must land before a later `update` to
 * the same record. A successfully replayed row is deleted from the outbox —
 * nothing reads a row's synced state, so there's no reason to keep it
 * around. If a row fails, the rest of that entity's chain is left alone (so
 * an edit never applies on top of a create that never landed), but other
 * entities keep processing. See `docs/offline-sync-design.md`.
 *
 * A row whose `dependsOnEntityId` still has an outstanding row elsewhere in
 * the outbox (e.g. a signature depending on its parent meeting log) is
 * skipped the same way — left `pending`, not attempted — until that
 * dependency clears. A `create` row whose replay fails with a recognizable
 * "already exists" error (see `isAlreadyExistsError`) is treated as a
 * success rather than a failure: the write actually landed on an earlier,
 * now-unconfirmed attempt. See `docs/meeting-flow-design.md`.
 *
 * A no-op if a flush is already running, so an `online` event, app boot, and
 * a manual "Retry now" click can't process the same row twice concurrently.
 * A row enqueued while a flush is already in flight (see `enqueueMutation`'s
 * `watchRowId`) just misses this pass and waits for the next trigger.
 */
export const flush = async (
  replay: Replayer,
  { watchRowId }: FlushOptions = {},
): Promise<void> => {
  if (isFlushing) return;
  isFlushing = true;

  try {
    const rows = await tailgateDb.outbox
      .where("status")
      .anyOf(RETRYABLE_STATUSES)
      .sortBy("createdAt");

    const poisonedEntityIds = new Set<string>();
    let watchedError: unknown;
    let watchedErrorCaught = false;

    for (const row of rows) {
      if (poisonedEntityIds.has(row.entityId)) continue;

      if (row.dependsOnEntityId) {
        const dependencyOutstanding = await tailgateDb.outbox
          .where("entityId")
          .equals(row.dependsOnEntityId)
          .count();
        if (dependencyOutstanding > 0) {
          // Left `pending` (not attempted, not failed) — the next flush
          // retries it once the dependency clears. Also poisons this row's
          // own entityId for the rest of *this* pass: a same-entityId
          // follow-up row (e.g. a signature's blob-upload row, chained to
          // its create via the ordinary same-entityId mechanism below) must
          // not slip through just because this row was merely skipped
          // rather than marked failed.
          poisonedEntityIds.add(row.entityId);
          continue;
        }
      }

      await withTimeout(
        tailgateDb.outbox.update(row.id, { status: "syncing" }),
        DEXIE_WRITE_TIMEOUT_MS,
      );

      try {
        await replay(row);
        // Deleted rather than marked "synced" and kept — nothing reads that
        // state, and leaving synced rows around forever would grow the
        // table unbounded over the life of the app. See
        // docs/offline-sync-design.md's addenda.
        await withTimeout(
          tailgateDb.outbox.delete(row.id),
          DEXIE_WRITE_TIMEOUT_MS,
        );
      } catch (error) {
        if (isAlreadyExistsError(row, error)) {
          // The create actually landed on an earlier attempt — treat this
          // exactly like success: delete the row, don't poison its
          // entityId, and (if this is the watched row) let the caller's
          // promise resolve normally instead of rejecting.
          await withTimeout(
            tailgateDb.outbox.delete(row.id),
            DEXIE_WRITE_TIMEOUT_MS,
          );
          continue;
        }

        poisonedEntityIds.add(row.entityId);

        if (
          row.id === watchRowId &&
          row.attempts === 0 &&
          !isNetworkOrTimeoutError(error)
        ) {
          await withTimeout(
            tailgateDb.outbox.delete(row.id),
            DEXIE_WRITE_TIMEOUT_MS,
          );
          watchedError = error;
          watchedErrorCaught = true;
        } else {
          await withTimeout(
            tailgateDb.outbox.update(row.id, {
              status: "failed",
              attempts: row.attempts + 1,
              lastError:
                error instanceof Error ? error.message : String(error),
            }),
            DEXIE_WRITE_TIMEOUT_MS,
          );
        }
      }
    }

    if (watchedErrorCaught) throw watchedError;
  } finally {
    isFlushing = false;
  }
};
