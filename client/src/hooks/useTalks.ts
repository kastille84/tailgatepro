import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../context/auth";
import { listTalks } from "../services/apiTalks";

/**
 * Loads the shared global talk library — one fetch, cached under `["talks"]`.
 * The ContentLibrary page filters/searches this in memory (trade + title),
 * rather than adding server-side query params. Disabled until a session
 * exists so the query never runs without a bearer token.
 */
export const useTalks = () => {
  const { session } = useAuth();

  const query = useQuery({
    queryKey: ["talks"],
    queryFn: () => listTalks(session!.access_token),
    enabled: !!session,
  });

  return {
    talks: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
};
