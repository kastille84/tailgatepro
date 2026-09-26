import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../context/auth";
import { getMeetingMonths } from "../services/apiMeetingLogs";

/**
 * The archive's month cards: one entry per month with a completed meeting,
 * newest first, plus the plan's history window and how many older logs it
 * hides (`hiddenCount`, for the upgrade banner). Months are bucketed in the
 * viewer's local timezone, so the offset is sent with the request. Online-only
 * and read-only, like `useGcOverview` — no offline cache fallback.
 */
export const useMeetingMonths = () => {
  const { session } = useAuth();

  const query = useQuery({
    queryKey: ["meetingMonths"],
    queryFn: () =>
      getMeetingMonths(session!.access_token, new Date().getTimezoneOffset()),
    enabled: !!session,
  });

  return {
    months: query.data?.months ?? [],
    hiddenCount: query.data?.hiddenCount ?? 0,
    historyDays: query.data?.historyDays ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
  };
};
