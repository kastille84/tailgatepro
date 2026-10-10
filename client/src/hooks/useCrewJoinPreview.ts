import { useQuery } from "@tanstack/react-query";

import { previewCrewJoin } from "../services/apiInHouseCrews";

/**
 * The public preview for a crew join link (Phase 13f-join): no session is
 * needed, since the foreman has no account yet. Disabled until a token is
 * present; `retry: false` so a bad or expired link shows its error state at
 * once instead of retrying a request that cannot succeed.
 */
export const useCrewJoinPreview = (token: string | undefined) => {
  const query = useQuery({
    queryKey: ["crewJoinPreview", token],
    queryFn: () => previewCrewJoin(token!),
    enabled: !!token,
    retry: false,
  });

  return {
    preview: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
  };
};
