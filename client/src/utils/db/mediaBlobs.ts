import { tailgateDb } from "./tailgateDb";
import { withTimeout } from "../withTimeout";
import type { MediaBlobRow } from "../../interfaces/mediaBlob";

// Mirrors outbox.ts's DEXIE_WRITE_TIMEOUT_MS — a stuck local write has no
// queue to fall back to, so it should reject for real rather than hang.
const DEXIE_WRITE_TIMEOUT_MS = 5_000;

/**
 * Stores a captured signature or crew-photo blob locally and returns its id.
 * Called eagerly, before the corresponding outbox row is enqueued (and
 * regardless of online status) — the blob must be durable on disk before
 * anything references it by id. The replay handler reads it back out at
 * flush time via `getMediaBlob` and deletes it via `deleteMediaBlob` once
 * the upload succeeds. See `docs/meeting-flow-design.md`.
 */
export const storeMediaBlob = async (blob: Blob): Promise<string> => {
  const row: MediaBlobRow = {
    id: crypto.randomUUID(),
    blob,
    mimeType: blob.type,
    createdAt: new Date().toISOString(),
  };

  await withTimeout(
    tailgateDb.mediaBlobs.add(row),
    DEXIE_WRITE_TIMEOUT_MS,
    "Couldn't save the capture locally — try again.",
  );

  return row.id;
};

/** Reads one stored blob back, or `undefined` if it's already been deleted
 *  (e.g. a replay handler retrying after a partial failure). */
export const getMediaBlob = async (
  id: string,
): Promise<MediaBlobRow | undefined> => tailgateDb.mediaBlobs.get(id);

/** Removes a stored blob once its upload has synced — see the replay
 *  handlers. Not called on a discarded/permanently-failed row; see Phase 4e's
 *  plan for that known gap. */
export const deleteMediaBlob = async (id: string): Promise<void> => {
  await withTimeout(
    tailgateDb.mediaBlobs.delete(id),
    DEXIE_WRITE_TIMEOUT_MS,
  );
};
