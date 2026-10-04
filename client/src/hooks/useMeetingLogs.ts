import { useInfiniteQuery } from "@tanstack/react-query";

import { useAuth } from "../context/auth";
import {
  getMeetingLogs,
  type MeetingLogsFilters,
} from "../services/apiMeetingLogs";

/** Rows per page — the server defaults to 50 and clamps to 200 either way. */
const PAGE_SIZE = 50;

/**
 * The caller's company's meeting logs, newest first, limited to the plan's
 * history window, loaded a page at a time (keyset cursor, so a meeting logged
 * while the list is open can't shift rows between pages). The archive passes a
 * `from`/`to` month range so only that month is fetched; `enabled` lets the
 * page skip the request until a month is chosen. Online-only and read-only,
 * like `useGcMeetings` — no offline cache fallback.
 */
export const useMeetingLogs = (
  filters: MeetingLogsFilters = {},
  enabled = true,
) => {
  const { session } = useAuth();

  const query = useInfiniteQuery({
    queryKey: ["meetingLogs", filters],
    queryFn: ({ pageParam }) =>
      getMeetingLogs(session!.access_token, filters, {
        limit: PAGE_SIZE,
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
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
