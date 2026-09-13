import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../context/auth";
import { listTalks } from "../services/apiTalks";

/**
 * Loads every talk visible to the caller's company — the shared global
 * library plus that company's own custom talks — one fetch, cached under
 * `["talks"]`. The ContentLibrary page filters/searches this in memory
 * (trade + title), rather than adding server-side query params.
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
    queryFn: () => listTalks(session!.access_token),
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
