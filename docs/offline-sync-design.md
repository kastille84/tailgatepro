# Offline Sync Design (Phase 3)

Status: decided (Phase 3 design spike, see `docs/tasks.md`). Covers the IndexedDB schema, sync
state machine, and conflict rule for the offline write queue. First consumer is the Projects
module (`create`/`update`/`archive`/`delete`); `meeting_logs`/`signatures` are Phase 4, once their
server API exists.

## Why one generic queue, not per-feature offline logic

`docs/data-access.md` already commits to a single, server-brokered write path so that
"queue-and-replay, conflict handling, `synced_at` stamping, and server-side PDF generation" stay
in one place. This doc is that queue's design: every client write — regardless of feature —
enqueues locally and replays against the same Express API endpoints the app already calls online.
There is no direct-to-Supabase path from the client and no separate "sync" endpoint; the queue's
flush step calls the exact same `routes/ → controllers/ → services/` trio a normal online request
would.

## IndexedDB schema (Dexie)

One Dexie database, `TailgateProDB`, version 1, opened as a module-level singleton in
`client/src/utils/db/tailgateDb.ts` (no `lib/` folder exists in this project's documented
structure, so the DB module lives under `utils/` instead).

- **`outbox`** — the sync queue. Key path `id` (a UUID for the queue row itself, distinct from the
  entity's id). Indexed on `status`, `entityId`, `createdAt`.
  - `entity: "project"` — a string union, extended in Phase 4 to add `"meeting_log" | "signature"`.
  - `entityId` — the affected record's UUID (the same id used in the eventual API call).
  - `op: "create" | "update" | "archive" | "delete"`.
  - `payload` — the exact request body to replay (e.g. `CreateProjectInput` including `id`, or
    `UpdateProjectPatch`).
  - `status: "pending" | "syncing" | "synced" | "failed"`.
  - `attempts: number`, `lastError: string | null`.
  - `createdAt` — client ISO timestamp, used to order the flush (see below).
  - `syncedAt: string | null` — set locally once the flush confirms success.
- **`projectsCache`** — key path `id` only. A read-through cache of `Project[]`, refreshed
  whenever `listProjects` succeeds online and read from when that call fails or the app is
  offline, so `useProjects` keeps returning data offline. `archivedAt` is **not** indexed —
  IndexedDB keys can't be `null`, and most cached projects are live (`archivedAt: null`), so a
  "find non-archived" query would throw on `.equals(null)`. The cache is one company's worth of
  projects, small enough to filter in memory instead.
- **`talksCache`** — same idea, key path `id`, indexed on `tradeTag`, for offline browsing of the
  toolbox-talk library.

`meeting_logs` and `signatures` are **not** given cache/queue tables yet. The `outbox`'s
`entity`/`op`/`payload` shape already accommodates them, but no server routes exist for either
table today (confirmed empty in `server/routes/`, `server/controllers/`, `server/services/`), so
wiring them in now would mean guessing at a contract Phase 4 hasn't designed — including the
photo-upload and PDF-generation flow that `meeting_logs.crew_photo_url`/`final_pdf_url` imply.

## Sync state machine

States: `pending → syncing → synced`, with `syncing → failed → pending` on error — a failed
attempt re-queues for the next flush rather than getting stuck.

- **Enqueue** (`enqueueMutation` in `client/src/utils/db/outbox.ts`) writes a `pending` row,
  optimistically updates the relevant TanStack Query cache, and returns immediately. The caller
  sees the same synchronous-feeling result whether the app is online or offline.
- **Flush triggers:** the browser `online` event, app boot (rows can be left `pending`/`syncing`
  from a previous session), a manual "Retry now" action in the offline indicator, and a ~30s
  interval while pending rows exist as a backstop — the `online` event does not fire reliably on
  every mobile browser.
- **Flush order:** process `pending`-or-`failed` rows in `createdAt` order, **per `entityId`, one
  at a time** — a `create` must land before a later `update` to the same record. On success: mark
  `synced`, stamp `syncedAt`, and leave the row (rows are small; pruning old `synced` rows is a
  deferred cleanup, not required for correctness — `pendingCount`/the next flush only ever look at
  `pending`/`failed` rows, so a lingering `synced` row is inert). On failure: mark `failed`,
  increment `attempts`, store `lastError` — the row stays retry-eligible for the next flush trigger
  rather than needing to bounce back through `pending` first — and stop that entity's remaining
  chain without blocking other entities' rows. `flush` itself is a no-op while already running, so
  the `online` event, app boot, and a manual retry can't double-process the same row.
- **Crash mid-flight:** on boot, any row still marked `syncing` is stale (the app closed mid
  network call) and is reset to `pending` before a new flush starts.
- **Retried `create` idempotency:** because a `create`'s id is generated client-side before the
  first attempt, a retry after a crash replays a `POST` with an id that may already exist
  server-side. The create endpoint needs to answer that case with a clean, distinguishable
  response (e.g. `409`) rather than a generic `500`, so the client can treat "already exists" as
  success instead of retrying forever. `update`/`archive`/`delete` are naturally idempotent —
  re-applying the same patch, or hitting an already-deleted row, resolves to the same end state.

## Conflict resolution: last-write-wins, no merge UI

`projects` has no `updated_at` or `synced_at` column (only `meeting_logs` has `synced_at`), so
there is no server-side value to diff against at replay time — a queued write always applies as
given, the same way a normal online `PATCH` does today. This is a deliberate simplification, not
an oversight:

- Two edits queued on the *same device* to the same record already resolve correctly by
  construction, since the flush applies them in `createdAt` order.
- Two edits queued on *different devices* while both are offline resolve by replay order:
  whichever device's queue flushes to the server second wins, silently — no diff, no warning, no
  merge UI. Given the single-foreman-per-project workflow this targets, concurrent offline edits
  to the same record are expected to be rare, and building cross-device conflict detection would
  need a server schema change (an `updated_at` column) for a scenario this app doesn't otherwise
  need to support yet.

## Write path: always through the queue

Every project mutation — online or offline — enqueues through the same `enqueueMutation` call;
there is no branch on `navigator.onLine`. When online, the queue attempts an immediate flush right
after enqueueing, so perceived latency matches today's direct API calls; when offline, the same
call just durably queues instead. This avoids maintaining two write paths per mutation (one direct,
one queued), which was the exact failure mode `docs/data-access.md` already rejected at the
API-vs-Supabase layer.

`useCreateProject`/`useUpdateProject`/`useArchiveProject`/`useDeleteProject` swap their
`mutationFn` to call `enqueueMutation({ entity: "project", op, entityId, payload })` instead of
calling `apiProjects.*` directly. `enqueueMutation` optimistically writes the pending change into
the `["projects"]` TanStack Query cache (tagged with a local-only "pending sync" flag for a UI
badge) and reconciles it with the server's response once the flush confirms, or leaves it flagged
as failed/pending if the flush errors. `apiProjects.ts`'s functions stay as thin fetch wrappers —
they become what the queue's flush step calls internally. `createProject` changes to accept an
explicit `id` (generated at the hook/enqueue layer) instead of generating one internally at fetch
time, since the queue needs the id before the network call to key the optimistic cache write and
correlate a later edit with a still-in-flight create.

## Online/offline indicator

A new `client/src/context/online-status/` module (mirroring the existing
`client/src/context/pwa-install/` structure) exposes `{ isOnline, pendingCount, retryNow }` via a
provider + `useOnlineStatus()` hook, seeded from `navigator.onLine` and updated on the `online`/
`offline` window events, plus a 30s poll as a backstop (the `online` event doesn't fire reliably on
every mobile network transition). A small non-blocking banner (`ui_comps/sync-status-banner/`)
shows when offline or `pendingCount > 0`, with a "Retry now" button, reusing the existing `Button`
primitive so the touch target and styling stay consistent with the rest of the app.

The provider needs *some* `Replayer` (see "Write path" above) to pass to `outbox.flush`, but has no
business knowing about Projects specifically. `client/src/utils/db/replayRegistry.ts` bridges the
two: `registerReplayHandler(entity, handler)` lets a feature register how to replay its own rows,
and `createReplayer(accessToken)` builds a `Replayer` that dispatches each row to whichever handler
is registered for its `entity`. The Projects retrofit (step 5) is what actually calls
`registerReplayHandler("project", ...)` — until then the registry is wired up and tested, but has
no handlers, so a "project" row would fail loudly (by design) rather than silently drop.

## Service worker: unchanged

The sync queue runs entirely in the main thread (the `online` event, app boot, and manual retry) —
no Background Sync API, no changes to `client/src/service-worker.ts`, which keeps bypassing
non-GET requests exactly as it does today. The accepted tradeoff: a write made offline only syncs
once the user reopens or foregrounds the app while connected, not while the app is fully closed.
Background Sync would remove that limitation but has no Safari/iOS support and would require
duplicating queue logic inside the service-worker context — not worth it for a workflow where the
foreman regains signal and reopens or keeps using the app.

## Landing order

This is split into five sequential, independently reviewable changes:

1. This design doc.
2. Dexie schema (`utils/db/tailgateDb.ts`, `interfaces/sync.ts`) with unit tests, no consumers.
3. Outbox queue logic (`utils/db/outbox.ts`) with unit tests, still no UI/hook consumers. `flush`
   takes a `Replayer` callback rather than importing `apiProjects` directly, so the queue engine
   has no React/auth dependency and is fully testable with a fake; the concrete replayer (built
   from the session's access token) is wired up in step 5.
4. Online/offline indicator (`context/online-status/`, `SyncStatusBanner`), wired into `App.tsx`.
5. The Projects retrofit — the only change that touches existing, shipped mutation behavior, so it
   lands last, once 2–4 are proven.

## Deferred to manual/E2E testing

Real multi-tab offline scenarios, actual airplane-mode device testing, browser storage-eviction
behavior, and true cross-device conflict scenarios are not practical to simulate meaningfully under
Vitest + `fake-indexeddb`. These get a manual pass before Phase 3 is considered fully verified,
rather than blocking on automated coverage.
