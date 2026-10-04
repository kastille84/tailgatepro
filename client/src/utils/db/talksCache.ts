import { tailgateDb } from "./tailgateDb";
import type { Talk } from "../../interfaces/talk";

/**
 * Merges a fresh online fetch into the offline read-through cache. Never
 * clears the table first, matching `cacheProjects` — see that function's
 * comment for the tradeoff this accepts.
 */
export const cacheTalks = async (talks: Talk[]): Promise<void> => {
  if (talks.length === 0) return;
  await tailgateDb.talksCache.bulkPut(talks);
};

/** Reads every cached talk — `useTalks`' offline fallback when the real
 *  fetch fails. Unlike `getCachedProjects`, there's no view to filter by. */
export const getCachedTalks = async (): Promise<Talk[]> => {
  return tailgateDb.talksCache.toArray();
};
