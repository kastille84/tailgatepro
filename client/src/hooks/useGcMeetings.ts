import { useInfiniteQuery } from "@tanstack/react-query";

import { useAuth } from "../context/auth";
import { getGcMeetings, type GcMeetingsFilters } from "../services/apiGc";

/** Rows per page — kept in sync with the server's default
 *  (`MEETINGS_PAGE_SIZE` in `server/services/gcDashboard.js`), but the server
 *  clamps and defaults independently either way. */
const PAGE_SIZE = 20;

/**
 * Completed logs for the caller's linked projects, optionally narrowed to one
 * project and/or a held-at range, paginated a page at a time. `enabled` lets
 * a caller (the drill-in modal) skip the network request entirely while
 * closed, without violating the rules-of-hooks by calling this conditionally.
 *
 * Online-only, read-only, same as `useGcOverview` — no offline cache
 * fallback.
 */
export const useGcMeetings = (
  filters: GcMeetingsFilters = {},
  enabled = true,
) => {
  const { session } = useAuth();

  const query = useInfiniteQuery({
    queryKey: ["gcMeetings", filters],
    queryFn: ({ pageParam }) =>
      getGcMeetings(session!.access_token, {
        ...filters,
        limit: PAGE_SIZE,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.length * PAGE_SIZE : undefined,
    enabled: !!session && enabled,
  });

  return {
    meetings: query.data?.pages.flatMap((page) => page.meetings) ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    hasNextPage: Boolean(query.hasNextPage),
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
  };
};
