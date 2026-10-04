import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../context/auth";
import { listFavorites } from "../services/apiFavorites";

/**
 * Loads the current user's favorited talk ids as a `Set<string>` for O(1)
 * lookup from FavoriteButton and the ContentLibrary "Favorites only" filter.
 * Cached under `["favorites"]` — favorites are per-user, not per-company, so
 * (unlike useProjects) there's no extra key segment. Disabled until a session
 * exists so the query never runs without a bearer token.
 */
export const useFavorites = () => {
  const { session } = useAuth();

  const query = useQuery({
    queryKey: ["favorites"],
    queryFn: () => listFavorites(session!.access_token),
    enabled: !!session,
  });

  const favoriteIds = useMemo(
    () => new Set((query.data ?? []).map((row) => row.talkId)),
    [query.data],
  );

  return {
    favoriteIds,
    isLoading: query.isLoading,
    isError: query.isError,
  };
};
