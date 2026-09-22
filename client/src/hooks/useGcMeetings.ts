import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../context/auth";
import { getGcMeetings, type GcMeetingsFilters } from "../services/apiGc";

/**
 * Completed logs for the caller's linked projects, optionally narrowed to one
 * project and/or a held-at range. `enabled` lets a caller (the drill-in
 * modal) skip the network request entirely while closed, without violating
 * the rules-of-hooks by calling this conditionally.
 *
 * Online-only, read-only, same as `useGcOverview` — no offline cache
 * fallback.
 */
export const useGcMeetings = (
  filters: GcMeetingsFilters = {},
  enabled = true,
) => {
  const { session } = useAuth();

  const query = useQuery({
    queryKey: ["gcMeetings", filters],
    queryFn: () => getGcMeetings(session!.access_token, filters),
    enabled: !!session && enabled,
  });

  return {
    meetings: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
};
