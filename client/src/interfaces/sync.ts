/** Types for the offline write queue. See `docs/offline-sync-design.md` for the
 *  full design — schema, state machine, and conflict rule. */

/** Domains the outbox can queue a write for. `"crew_photo"` has no separate
 *  record of its own — a meeting has at most one, stored as a column on
 *  `meeting_logs` — so a crew-photo row reuses its parent meeting log's own
 *  id as `entityId` rather than getting a distinct id space. See
 *  `docs/meeting-flow-design.md`. */
export type SyncEntity =
  | "project"
  | "talk"
  | "meeting_log"
  | "signature"
  | "crew_photo";

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
  /** If set, this row is skipped (left `pending`, not attempted) for as long
   *  as a row with this `entityId` is still in the outbox — i.e. its
   *  dependency hasn't synced yet. Needed only where a write's parent record
   *  has a genuinely different `entityId` and can't rely on the outbox's
   *  existing same-`entityId` ordering (e.g. a signature depends on its
   *  parent meeting log). Undefined for every Projects/Talks row and for any
   *  row with no cross-entity dependency. See `docs/meeting-flow-design.md`. */
  dependsOnEntityId?: string;
}
