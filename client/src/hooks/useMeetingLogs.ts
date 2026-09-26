import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../context/auth";
import {
  getMeetingLogs,
  type MeetingLogsFilters,
} from "../services/apiMeetingLogs";

/**
 * The caller's company's meeting logs, newest first, limited to the plan's
 * history window. The archive passes a `from`/`to` month range so only that
 * month is fetched; `enabled` lets the page skip the request until a month is
 * chosen. Online-only and read-only, like `useGcMeetings` — no offline cache
 * fallback.
 */
export const useMeetingLogs = (
  filters: MeetingLogsFilters = {},
  enabled = true,
) => {
  const { session } = useAuth();

  const query = useQuery({
    queryKey: ["meetingLogs", filters],
    queryFn: () => getMeetingLogs(session!.access_token, filters),
    enabled: !!session && enabled,
  });

  return {
    meetings: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
};
