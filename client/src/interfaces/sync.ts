/** Types for the offline write queue. See `docs/offline-sync-design.md` for the
 *  full design — schema, state machine, and conflict rule. */

/** Domains the outbox can queue a write for. `"crew_photo"` and
 *  `"meeting_completion"` have no separate record of their own — a meeting
 *  has at most one crew photo (a column on `meeting_logs`) and exactly one
 *  completion action — so both reuse their parent meeting log's own id as
 *  `entityId` rather than getting a distinct id space. See
 *  `docs/meeting-flow-design.md`. */
export type SyncEntity =
  | "project"
  | "talk"
  | "meeting_log"
  | "signature"
  | "crew_photo"
  | "meeting_completion";

/** The HTTP-shaped operation a queued row replays as. `archive` maps to
 *  `PATCH /api/projects/:id` with `{ archived: true | false }` — the payload's
 *  `archived` flag says whether it's archiving or restoring. `complete` maps
 *  to `PATCH /api/meetings/:id/complete` (a `"meeting_completion"` row) —
 *  kept distinct from `update` so the outbox can recognize a retried
 *  already-completed replay as a success rather than a real failure. */
export type SyncOp = "create" | "update" | "archive" | "delete" | "complete";

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
   *  as ANY row with one of these `entityId`s is still in the outbox — i.e.
   *  at least one dependency hasn't synced yet. Needed only where a write's
   *  parent record(s) have a genuinely different `entityId` and can't rely on
   *  the outbox's existing same-`entityId` ordering (e.g. a signature depends
   *  on its parent meeting log; a meeting's completion depends on every
   *  signature collected for it). Undefined for every Projects/Talks row and
   *  for any row with no cross-entity dependency. See
   *  `docs/meeting-flow-design.md`. */
  dependsOnEntityIds?: string[];
}
