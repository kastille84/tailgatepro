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
  at a time** — a `create` must land before a later `update` to the same record. On success: the
  row is deleted (see addenda — this was originally "mark synced and leave it," changed after the
  fact). On failure: mark `failed`,
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

## Addendum: what the Projects retrofit (step 5) actually needed

Building the retrofit surfaced a few things the design above didn't cover. Recorded here rather
than rewritten into the sections above, so the reasoning stays visible.

**Error surfacing.** The queue's original "flush swallows every error and retries later" behavior
would have silently closed `ProjectForm` on a validation error (a duplicate name, a missing GC
field) or the 409 "archive instead of delete" guard — the request would be queued instead of
rejected, and would then fail identically forever since retrying an invalid payload can never
succeed. Fixed by having `flush` accept an optional `watchRowId`: when `enqueueMutation` makes its
first, synchronous attempt while online, it passes its own row's id as `watchRowId`. If that
specific row fails on its first attempt (`attempts === 0`), the row is deleted (not retried) and
the error is rethrown out of `enqueueMutation` — a synchronous online mutation gets the same
immediate rejection a direct API call always gave. A row that fails on any later attempt (a
genuine offline queue, or a retry after the original caller is long gone) still fails silently and
stays retry-eligible, as originally designed. If an entity already has an earlier unsynced row when
a new one is enqueued, the new one skips this "watched" fast path entirely and just joins the queue
behind it, so per-`entityId` ordering is never bypassed.

**Cache reconciliation across triggers.** Whichever hook makes a mutation, the write might not be
confirmed until later — the `online` event, a manual retry, or the backstop poll, none of which run
inside that hook. So instead of each hook invalidating `["projects"]` in its own `onSuccess` (which
would refetch immediately and, if still offline, blow away the optimistic entry with a stale cache
read), the registered "project" replay handler (`services/projectReplayHandler.ts`) invalidates
`["projects"]` itself, once, right after any successful replay — regardless of what triggered it.
This needed the app's `QueryClient` to be reachable from outside the component tree, so it moved
from a local variable in `App.tsx` into `utils/queryClient.ts` as a singleton; components still get
the same instance via `useQueryClient()` as before.

**Optimistic updates.** Each mutation hook now has an `onMutate`/`onError` pair: `onMutate` snapshots
every cached `["projects", ...]` list (`snapshotProjectsQueries`), applies the change immediately
(`upsertCachedProject` for create/update/archive, `removeCachedProject` for delete,
`applyProjectPatch` to merge a patch onto a cached project for update/archive), and `onError` rolls
back to the snapshot if the mutation is rejected outright (per the point above, only a synchronous
online failure rejects). A newly-created project's `ownerCompanyId` is set to `""` as a placeholder
until the write syncs — it's never read anywhere in the client (only passed through from the server),
so this is safe, and the real value arrives once the replay handler's invalidation refetches.

**No per-card "pending sync" badge.** The original plan mentioned tagging an optimistic entry with a
UI-visible "pending" flag. This landed without one — the app-wide `SyncStatusBanner` (step 4)
already surfaces "N changes waiting to sync," and a per-card badge would have meant threading new
props through `ProjectList`/`ProjectCard` plus new styles and tests for marginal added clarity. Can
be added later if the global banner turns out not to be enough signal.

## Addendum: `fetch` needs a timeout, not just an online check

Found via a real repro: creating a project while "offline" (Chrome DevTools' Network tab set to
"Offline") hung the form's spinner forever. DevTools' offline throttle blocks real network
requests but does **not** flip `navigator.onLine` to `false` — so `enqueueMutation` believed it
was online and attempted an immediate sync, and `apiProjects.ts`'s bare `fetch()` calls (no
`AbortController`, no timeout) simply never resolved or rejected under that simulation. That hung
`flush`'s `await replay(row)` forever, which meant its `finally { isFlushing = false }` never ran —
wedging the module-level lock `true` for the rest of the session and silently turning every later
flush trigger (the `online` event, the 30s poll, "Retry now") into a no-op until a full reload.

Fixed with `client/src/utils/fetchWithTimeout.ts` — a `fetch` wrapper using `AbortController` with
a 10s default timeout, used by all four `apiProjects.ts` calls. This also required `outbox.ts`'s
`flush` to distinguish *why* a watched row's first attempt failed: a genuine server rejection
(`apiProjects.ts`'s `Error(body?.error ?? GENERIC_ERROR)`, thrown only after a response is actually
received) still discards the row and rejects the caller immediately, as designed — but a network
failure (`TypeError`, per the Fetch spec) or a timeout (`AbortError`) now falls through to the same
path as any other retryable failure: stays queued, resolves normally, no discard. `navigator.onLine`
stays as a fast-path heuristic (skipping a doomed attempt when we're confident we're offline) since
the timeout now bounds the cost of it being wrong to 10 seconds instead of forever.

## Addendum: the local write itself needs a timeout too

Round 2 of the same bug class, this time genuinely offline (Wi-Fi disabled for real, confirmed by
the app's own banner — so `navigator.onLine` was correctly `false` and `flush`/`fetch` were never
reached at all). "Create project" still hung: the spinner never stopped, the modal never closed,
and the `outbox` table stayed empty. With the network path provably unreached, the only remaining
`await` in that branch is `tailgateDb.outbox.add(row)` itself — a bare Dexie call with no timeout,
and nothing anywhere in this codebase handling IndexedDB's `blocked`/`versionchange` events. A
native IndexedDB request that never fires `success` or `error` (most plausibly a connection blocked
by another open tab, or a stale connection from an iterative dev session) produces exactly these
symptoms.

Fixed the same way as the fetch case, one layer down: `client/src/utils/withTimeout.ts` races a
promise against a timer (5s — legitimate IndexedDB latency is never multi-second). Unlike
`fetchWithTimeout`, this can't actually cancel the underlying operation — Dexie has no cancellation
primitive — so a "timeout" here means "stop waiting and give the caller an answer," not "the
operation stopped." Applied to `enqueueMutation`'s initial write and `flush`'s per-row status
updates/delete in `outbox.ts`. Also added the two Dexie connection-hygiene handlers this codebase
had neither of: `versionchange` (close this tab's connection so it doesn't block another tab's
upgrade) and `blocked` (log it, since there was previously no way to even detect it), plus a Vite
HMR dispose hook so iterating on `tailgateDb.ts` during dev doesn't accumulate orphaned connections
across hot-reloads.

Unlike a network failure, a timed-out local write has no queue to fall back to — there's nowhere
else to durably store the change — so it's a real rejection, not a quiet "stays queued" like the
network case: the mutation rejects, the form shows an honest error and stays open, and the
already-applied optimistic tile rolls back via the same `onError` path already built for a
server-rejected mutation.

## Addendum: the real cause was TanStack Query's default `networkMode`

Rounds 1–2 above were real, valid fixes — but neither was the actual reason "Create project" hung
while genuinely offline. The tell was in the third repro: while offline, *nothing* happened at
all — no outbox row, no network call — and the instant Wi-Fi came back on, an outbox row appeared,
a network request fired, and the modal closed, all together. That's not "some `await` hangs
forever" (rounds 1–2's shape); it's "the code never starts running until connectivity returns."

That's exactly what `useMutation`/`useQuery` do by default: every one has a `networkMode` option
defaulting to `"online"`, backed by TanStack Query's own `onlineManager` (which just subscribes to
`navigator.onLine` and the `online`/`offline` events — the same signal this app's own code already
uses). While the manager considers the browser offline, `mutationFn`/`queryFn` is **never invoked
at all** — not paused mid-flight, never started — and only runs once an `online` event fires and
the library auto-resumes it. Since nothing in this app ever configured `networkMode`, this was
invisible to two full rounds of tracing `outbox.ts`, `apiProjects.ts`, `tailgateDb.ts`, and every
`navigator.onLine`/`fetch(` call site: the gate is one layer above all of that, inside the library,
and it pauses the *whole* function — including the local, no-network Dexie write inside
`enqueueMutation`, not just the eventual network call.

This also explains why round 1's fix looked like it worked: DevTools' Offline throttle doesn't flip
`navigator.onLine`, so `onlineManager` also saw "online" and let `mutationFn` run normally, reaching
the real `fetch()` that round 1's timeout fixed. Round 2's genuinely-offline repro (and this one)
had `navigator.onLine` truly `false`, so TanStack Query paused `mutationFn` before it ever reached
the Dexie write round 2 was bounding — a correct fix for code that was never being reached.

**Fix:** `networkMode: "always"` on every Projects `useMutation` and on `useProjects`'s `useQuery` —
TanStack Query's own documented recommendation for an app that manages its own offline
persistence/queue instead of relying on the library's pause-and-resume. With it, `mutationFn`/
`queryFn` always runs immediately, online or offline, and this app's own `navigator.onLine` checks
(in `enqueueMutation`, and `useProjects`'s try/catch-to-cache) become the only thing deciding what
happens next — which is what `outbox.ts`'s doc comments described as the design all along. Confirmed
with a test that fails in exactly the right way without the fix: `onlineManager.setOnline(false)`
before calling a mutation hook, with `networkMode` unset, times out at Vitest's default 15s (proving
`mutationFn` never runs); with `networkMode: "always"` restored, the same test resolves in
milliseconds. Rounds 1–2's fixes are unchanged and still valid for the cases where `mutationFn` does
run and something inside it stalls.

## Addendum: synced rows are deleted, not kept

The original design (above, and this doc's first draft) left a successfully-synced row in place,
marked `status: "synced"` with `syncedAt` stamped — reasoned as harmless since `pendingCount`/the
next flush only ever look at `pending`/`failed` rows. Once the queue was actually working
end-to-end, the practical downside became obvious: synced rows just accumulate in `outbox` forever,
which is both an unbounded storage/table-growth concern over the life of the app and made the table
noisy to inspect while debugging. Nothing in the app ever reads a row's synced state, so there was
no upside to keeping it. Changed `flush()` to delete a row immediately once it's replayed
successfully, instead of marking it synced. `"synced"` stays in the `SyncStatus` type and
`syncedAt` stays on `OutboxRow` for now rather than removing them — a row simply never persists in
that state anymore, but the fields are harmless to keep and removing them would mean touching every
place that constructs an `OutboxRow` (including several test files) for no functional gain.

## Deferred to manual/E2E testing

Real multi-tab offline scenarios, actual airplane-mode device testing, browser storage-eviction
behavior, and true cross-device conflict scenarios are not practical to simulate meaningfully under
Vitest + `fake-indexeddb`. These get a manual pass before Phase 3 is considered fully verified,
rather than blocking on automated coverage.
