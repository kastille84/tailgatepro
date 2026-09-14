import type { QueryClient } from "@tanstack/react-query";

import type { Talk } from "../interfaces/talk";
import type { UpdateTalkInput } from "../services/apiTalks";

/** The one cache entry `useTalks` populates — unlike Projects, there's no
 *  `{ includeArchived }` split to account for. */
export const TALKS_QUERY_KEY = ["talks"] as const;

/** Snapshot the cached talks list, to hand to `restoreTalksQueries` if a
 *  queued write is rejected outright (see `docs/offline-sync-design.md`). */
export const snapshotTalksQueries = (queryClient: QueryClient) =>
  queryClient.getQueriesData<Talk[]>({ queryKey: TALKS_QUERY_KEY });

/** Rolls back to a snapshot taken by `snapshotTalksQueries`. */
export const restoreTalksQueries = (
  queryClient: QueryClient,
  snapshot: ReturnType<typeof snapshotTalksQueries>,
): void => {
  snapshot.forEach(([key, data]) => queryClient.setQueryData(key, data));
};

/** The cached copy of a talk, if one is cached — used to build an
 *  optimistic entry from a cached talk plus the patch being sent. */
export const findCachedTalk = (
  queryClient: QueryClient,
  id: string,
): Talk | undefined => {
  for (const [, data] of snapshotTalksQueries(queryClient)) {
    const found = data?.find((talk) => talk.id === id);
    if (found) return found;
  }
  return undefined;
};

/** Merges an `UpdateTalkInput` onto a full `Talk`, approximating the
 *  server's full-replace PATCH: every field it carries overwrites the
 *  matching `Talk`/`structured` field. Unlike `applyProjectPatch`, there's
 *  no archived/timestamp special case. Used by `useUpdateTalk` to build an
 *  optimistic entry from a cached talk plus the input being sent. */
export const applyTalkPatch = (
  existing: Talk,
  patch: UpdateTalkInput,
): Talk => ({
  ...existing,
  title: patch.title,
  tradeTag: patch.tradeTag ?? null,
  tradeTags: patch.tradeTag ? [patch.tradeTag] : [],
  structured: {
    summary: patch.summary ?? null,
    talking_points: patch.talkingPoints,
    site_hazards_to_check: patch.siteHazardsToCheck ?? [],
    discussion_questions: patch.discussionQuestions ?? [],
    osha_standards: patch.oshaStandards ?? [],
    estimated_minutes: patch.estimatedMinutes ?? null,
  },
});

/** Optimistically inserts or replaces a talk by id in the cached list. No
 *  view-exclusion branch — Talks has one single `["talks"]` cache, unlike
 *  Projects' default/"show archived" split. */
export const upsertCachedTalk = (
  queryClient: QueryClient,
  talk: Talk,
): void => {
  snapshotTalksQueries(queryClient).forEach(([key, current]) => {
    if (!current) return;
    const index = current.findIndex((t) => t.id === talk.id);
    queryClient.setQueryData(
      key,
      index === -1
        ? [...current, talk]
        : current.map((t, i) => (i === index ? talk : t)),
    );
  });
};

/** Optimistically removes a deleted talk from the cached list. */
export const removeCachedTalk = (
  queryClient: QueryClient,
  talkId: string,
): void => {
  snapshotTalksQueries(queryClient).forEach(([key, current]) => {
    if (!current) return;
    queryClient.setQueryData(
      key,
      current.filter((t) => t.id !== talkId),
    );
  });
};
