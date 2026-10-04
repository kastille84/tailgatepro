import type { OutboxRow, SyncEntity } from "../../interfaces/sync";
import type { Replayer } from "./outbox";

/**
 * Replays one outbox row against the real API for one entity type. The
 * feature that owns an entity registers its handler once — e.g. Projects
 * registers `"project"` when its hooks are retrofitted through the queue
 * (`docs/offline-sync-design.md`, landing order step 5). Kept separate from
 * `outbox.ts` so the generic queue engine never has to import a specific
 * feature's API service.
 */
export type ReplayHandler = (
  accessToken: string,
  row: OutboxRow,
) => Promise<void>;

const handlers: Partial<Record<SyncEntity, ReplayHandler>> = {};

export const registerReplayHandler = (
  entity: SyncEntity,
  handler: ReplayHandler,
): void => {
  handlers[entity] = handler;
};

/** Test-only: clears every registered handler between test files/cases. */
export const resetReplayHandlers = (): void => {
  (Object.keys(handlers) as SyncEntity[]).forEach((key) => {
    delete handlers[key];
  });
};

/** Builds a `Replayer` (see `outbox.ts`) bound to one access token, that
 *  dispatches each row to whichever handler is registered for its `entity`.
 *  A row for an entity with no registered handler fails loudly rather than
 *  silently dropping — that should only happen if a feature enqueues writes
 *  before registering its handler. */
export const createReplayer = (accessToken: string): Replayer => {
  return async (row) => {
    const handler = handlers[row.entity];
    if (!handler) {
      throw new Error(`No replay handler registered for entity "${row.entity}"`);
    }
    await handler(accessToken, row);
  };
};
