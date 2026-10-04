import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../context/auth";
import { listTalks } from "../services/apiTalks";
import { cacheTalks, getCachedTalks } from "../utils/db/talksCache";

/**
 * Loads every talk visible to the caller's company — the shared global
 * library plus that company's own custom talks — one fetch, cached under
 * `["talks"]`. The ContentLibrary page filters/searches this in memory
 * (trade + title), rather than adding server-side query params.
 *
 * Every successful fetch is mirrored into the offline `talksCache`
 * (`docs/offline-sync-design.md`); if the fetch fails — most commonly
 * because the device is offline — the cached list is returned instead, and
 * only propagates as an error when nothing is cached either. Mirrors
 * `useProjects`.
 *
 * `tradeOptions` is derived here (not in ContentLibrary) because it now has
 * two consumers — ContentLibrary's trade filter and TalkForm's trade
 * `<datalist>` — both already going through this one talks hook; it carries
 * no "all trades" entry, since that's filter-specific presentation, not data.
 *
 * Disabled until a session exists so the query never runs without a bearer
 * token.
 */
export const useTalks = () => {
  const { session } = useAuth();

  const query = useQuery({
    queryKey: ["talks"],
    // Without this, TanStack Query's default networkMode would pause this
    // ENTIRE queryFn — including its own try/catch fallback to the offline
    // cache below — until its onlineManager sees an `online` event. See
    // useProjects.ts / docs/offline-sync-design.md.
    networkMode: "always",
    queryFn: async () => {
      try {
        const talks = await listTalks(session!.access_token);
        await cacheTalks(talks);
        return talks;
      } catch (error) {
        const cached = await getCachedTalks();
        if (cached.length > 0) return cached;
        throw error;
      }
    },
    enabled: !!session,
  });

  // Memoized (not just `query.data ?? []`) so a still-`undefined` query.data
  // doesn't hand back a fresh `[]` reference every render, which would
  // otherwise make tradeOptions below recompute on every render too.
  const talks = useMemo(() => query.data ?? [], [query.data]);

  const tradeOptions = useMemo(() => {
    const trades = new Set<string>();
    talks.forEach((talk) => talk.tradeTags.forEach((t) => trades.add(t)));
    return Array.from(trades)
      .sort((a, b) => a.localeCompare(b))
      .map((t) => ({ value: t, label: t }));
  }, [talks]);

  return {
    talks,
    tradeOptions,
    isLoading: query.isLoading,
    isError: query.isError,
  };
};
