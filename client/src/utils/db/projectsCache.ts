import { tailgateDb } from "./tailgateDb";
import type { Project } from "../../interfaces/project";

/**
 * Merges a fresh online fetch into the offline read-through cache. Never
 * clears the table first — a fetch scoped to one `includeArchived` view
 * would otherwise wipe out projects cached under the other view. The
 * tradeoff: a project deleted server-side, or archived since it was last
 * cached, can linger here until the next fetch that includes it — acceptable
 * for a fallback that's only ever read when the real list can't be reached.
 */
export const cacheProjects = async (projects: Project[]): Promise<void> => {
  if (projects.length === 0) return;
  await tailgateDb.projectsCache.bulkPut(projects);
};

/** Reads the cached projects, filtered the same way `GET /api/projects`
 *  filters by default — `useProjects`' offline fallback when the real fetch
 *  fails. `archivedAt` isn't indexed (see `tailgateDb.ts`), so this filters
 *  the small cached list in memory rather than querying it. */
export const getCachedProjects = async (
  includeArchived: boolean,
): Promise<Project[]> => {
  const all = await tailgateDb.projectsCache.toArray();
  return includeArchived ? all : all.filter((p) => p.archivedAt === null);
};
