/** Types for the offline write queue. See `docs/offline-sync-design.md` for the
 *  full design — schema, state machine, and conflict rule. */

/** Domains the outbox can queue a write for. Extended in Phase 4 to add
 *  "meeting_log" | "signature" once their server API exists. */
export type SyncEntity = "project" | "talk";

/** The HTTP-shaped operation a queued row replays as. `archive` maps to
 *  `PATCH /api/projects/:id` with `{ archived: true | false }` — the payload's
 *  `archived` flag says whether it's archiving or restoring. */
export type SyncOp = "create" | "update" | "archive" | "delete";

/** Lifecycle of one queued mutation. `syncing` rows found at app boot are
 *  stale (the app closed mid-request) and get reset to `pending`. */
export type SyncStatus = "pending" | "syncing" | "synced" | "failed";

/** One row in the `outbox` IndexedDB table — a single mutation waiting to be
 *  replayed against the API, or already replayed. */
export interface OutboxRow {
  /** This queue row's own id — distinct from `entityId`. */
  id: string;
  entity: SyncEntity;
  /** The affected record's id (the same id the API call uses). */
  entityId: string;
  op: SyncOp;
  /** The exact request body to replay, e.g. a `CreateProjectInput` (with its
   *  `id` included) or an `UpdateProjectPatch`. */
  payload: Record<string, unknown>;
  status: SyncStatus;
  attempts: number;
  lastError: string | null;
  /** Client ISO timestamp at enqueue time — orders the flush per `entityId`. */
  createdAt: string;
  /** Set locally once the flush confirms the write landed. Not a server
   *  column — `projects` has no `synced_at`, so this state lives only here. */
  syncedAt: string | null;
}
