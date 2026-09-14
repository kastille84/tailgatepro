import Dexie, { type EntityTable } from "dexie";

import type { OutboxRow } from "../../interfaces/sync";
import type { Project } from "../../interfaces/project";
import type { Talk } from "../../interfaces/talk";

/**
 * The app's local IndexedDB, via Dexie. See `docs/offline-sync-design.md` for
 * why each table exists and how it's used.
 *
 * - `outbox` — the offline write queue (see `interfaces/sync.ts`).
 * - `projectsCache` / `talksCache` — read-through caches so `useProjects` /
 *   `useTalks` can still return data when the network call fails or the app
 *   is offline. Populated on a successful online fetch, read from otherwise.
 *
 * `meeting_logs`/`signatures` do not get tables here yet — no server API
 * exists for either (Phase 4); adding cache/queue support for them now would
 * mean guessing at a contract that hasn't been designed.
 *
 * Opened once as a module-level singleton, mirroring the singleton
 * `queryClient` in `App.tsx`.
 */
class TailgateProDB extends Dexie {
  outbox!: EntityTable<OutboxRow, "id">;
  projectsCache!: EntityTable<Project, "id">;
  talksCache!: EntityTable<Talk, "id">;

  constructor() {
    super("TailgateProDB");

    // `projectsCache.archivedAt` is NOT indexed: IndexedDB keys can't be
    // `null`, and most cached projects are live (`archivedAt: null`), so a
    // "find non-archived" query would throw on `.equals(null)`. The cache is
    // small (one company's projects) — filter it in memory instead.
    this.version(1).stores({
      outbox: "id, status, entityId, createdAt",
      projectsCache: "id",
      talksCache: "id, tradeTag",
    });
  }
}

export const tailgateDb = new TailgateProDB();

// Standard Dexie multi-connection hygiene — this codebase had neither handler
// before, so a blocked connection (another tab, or a stale connection from
// hot-reloading during dev) would hang silently forever. See
// docs/offline-sync-design.md's addenda. Exported as named functions (rather
// than inline in `.on(...)`) so their behavior is unit-testable without
// needing to trigger a real IndexedDB versionchange/blocked event.

/** `versionchange` fires on THIS connection when some other tab/instance
 *  opens a newer version — closing here lets that upgrade proceed instead of
 *  this tab blocking it. */
export const handleVersionChange = (): void => {
  tailgateDb.close();
};

/** `blocked` fires on a newer connection that's waiting on this one (or
 *  another) to close — there's currently nothing to detect this at all, so
 *  at minimum surface it. */
export const handleBlocked = (): void => {
  console.warn("TailgateProDB: blocked by another open connection.");
};

tailgateDb.on("versionchange", handleVersionChange);
tailgateDb.on("blocked", handleBlocked);

// Dev-only: close the connection when this module is hot-replaced, so
// iterating on it (or anything that imports it) doesn't accumulate orphaned
// connections across hot-reloads within one tab. `import.meta.hot` doesn't
// exist under Vitest/production builds, so this can't be exercised by tests.
/* v8 ignore start */
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    tailgateDb.close();
  });
}
/* v8 ignore stop */
