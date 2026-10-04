import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../context/auth";
import { getGcSubcontractorScorecards } from "../services/apiGc";

/**
 * Every distinct sub across the caller's active portfolio jobsites with a
 * rolling 30-day compliance score, worst-first (Phase 9e,
 * docs/sub-scorecard-design.md). `date` (`YYYY-MM-DD`) and `tzOffset`
 * (minutes, same sign as `Date#getTimezoneOffset()`) anchor the rolling
 * window's "today," same contract as `useGcOverview`.
 *
 * Online-only, read-only — no offline cache fallback, same reasoning as
 * `useGcOverview` (`docs/gc-dashboard-design.md` "Client notes"). Left at
 * TanStack's default `networkMode` ("online") so the query pauses while
 * offline and resumes on reconnect.
 */
export const useGcSubcontractorScorecards = (date: string, tzOffset: number, timeZone?: string) => {
  const { session } = useAuth();

  const query = useQuery({
    queryKey: ["gcSubcontractorScorecards", { date, tzOffset, timeZone }],
    queryFn: () => getGcSubcontractorScorecards(session!.access_token, date, tzOffset, timeZone),
    enabled: !!session,
  });

  return {
    scorecards: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
  };
};
