import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../context/auth";
import { getGcSubcontractorScorecard } from "../services/apiGc";

/**
 * One sub's rolling 30-day compliance score plus its per-jobsite breakdown
 * (Phase 9e, docs/sub-scorecard-design.md). Same `date`/`tzOffset` contract
 * as `useGcSubcontractorScorecards`. `error` is exposed (not just `isError`)
 * so the detail page can tell a 404 ("not a current roster member") apart
 * from any other failure by its message, the same way `PlanLimitError`
 * callers elsewhere in this codebase branch on a thrown error's shape.
 */
export const useGcSubcontractorScorecard = (
  companyId: string,
  date: string,
  tzOffset: number,
) => {
  const { session } = useAuth();

  const query = useQuery({
    queryKey: ["gcSubcontractorScorecard", companyId, { date, tzOffset }],
    queryFn: () =>
      getGcSubcontractorScorecard(session!.access_token, companyId, date, tzOffset),
    enabled: !!session && !!companyId,
  });

  return {
    scorecard: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
};
