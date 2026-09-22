import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../context/auth";
import { getGcOverview } from "../services/apiGc";

/**
 * Per-sub compliance for the caller's linked jobsites on the given local day.
 * `date` (`YYYY-MM-DD`) and `tzOffset` (minutes, same sign as
 * `Date#getTimezoneOffset()`) are the caller's local boundary — the server
 * never guesses a timezone.
 *
 * Online-only, read-only (`docs/gc-dashboard-design.md` "Client notes") — no
 * offline cache fallback here, unlike `useProjects`/`useTalks`. Left at
 * TanStack's default `networkMode` ("online") so the query simply pauses
 * while offline and resumes on reconnect, rather than failing.
 */
export const useGcOverview = (date: string, tzOffset: number) => {
  const { session } = useAuth();

  const query = useQuery({
    queryKey: ["gcOverview", { date, tzOffset }],
    queryFn: () => getGcOverview(session!.access_token, date, tzOffset),
    enabled: !!session,
  });

  return {
    overview: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
  };
};
