import { useEffect, useState } from "react";
import { liveQuery } from "dexie";

import { tailgateDb } from "../utils/db/tailgateDb";

const getUnsyncedProjectIds = async (): Promise<string[]> => {
  const rows = await tailgateDb.outbox.toArray();
  return rows
    .filter((row) => row.entity === "project" && row.op === "create")
    .map((row) => row.entityId);
};

/**
 * Ids of projects whose `create` is still in the offline outbox, i.e. not on
 * the server yet. Server calls that need the row to exist (link to GC) would
 * 404 for these, so the UI disables them until the flush deletes the row.
 *
 * Local IndexedDB state, not server state, so this subscribes with Dexie's
 * `liveQuery` (re-emits whenever the outbox changes) instead of TanStack Query.
 */
export const useUnsyncedProjectIds = (): Set<string> => {
  const [ids, setIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const subscription = liveQuery(getUnsyncedProjectIds).subscribe({
      next: (value) => setIds(new Set(value)),
      // A failed local read just means nothing is flagged as unsynced.
      error: () => setIds(new Set()),
    });
    return () => subscription.unsubscribe();
  }, []);

  return ids;
};
