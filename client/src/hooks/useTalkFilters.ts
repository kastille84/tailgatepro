import { useMemo, useState } from "react";

import type { SelectOption } from "../ui_comps/select";
import type { Talk } from "../interfaces/talk";

const ALL_TRADES = "all";

/**
 * Trade/search/favorites/custom filtering over an already-fetched talk list,
 * shared by ContentLibrary and the meeting wizard's talk-picker step so both
 * get identical filter behavior from one place.
 */
export const useTalkFilters = (
  talks: Talk[],
  tradeOptions: SelectOption[],
  favoriteIds: Set<string>,
) => {
  const [trade, setTrade] = useState(ALL_TRADES);
  const [search, setSearch] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [customOnly, setCustomOnly] = useState(false);

  const tradeFilterOptions = useMemo(
    () => [{ value: ALL_TRADES, label: "All trades" }, ...tradeOptions],
    [tradeOptions],
  );

  const visibleTalks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return talks.filter((talk) => {
      const matchesTrade =
        trade === ALL_TRADES || talk.tradeTags.includes(trade);
      const matchesSearch = !query || talk.title.toLowerCase().includes(query);
      const matchesFavorite = !favoritesOnly || favoriteIds.has(talk.id);
      const matchesCustom = !customOnly || !talk.isGlobal;
      return matchesTrade && matchesSearch && matchesFavorite && matchesCustom;
    });
  }, [talks, trade, search, favoritesOnly, favoriteIds, customOnly]);

  return {
    trade,
    setTrade,
    search,
    setSearch,
    favoritesOnly,
    setFavoritesOnly,
    customOnly,
    setCustomOnly,
    tradeFilterOptions,
    visibleTalks,
  };
};
