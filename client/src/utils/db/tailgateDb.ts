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
