import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../context/auth";
import { getGcPolicyPush } from "../services/apiGc";

/**
 * The caller's current top-down policy push plus, when one is active, a
 * per-active-jobsite compliance rollup since it was pushed (Phase 9e,
 * docs/policy-push-design.md). `date`/`tzOffset` anchor "today," same
 * contract as `useGcOverview`.
 *
 * Online-only, read-only — no offline cache fallback, same reasoning as
 * `useGcOverview`/`useGcSubcontractorScorecards`.
 */
export const useGcPolicyPush = (date: string, tzOffset: number) => {
  const { session } = useAuth();

  const query = useQuery({
    queryKey: ["gcPolicyPush", { date, tzOffset }],
    queryFn: () => getGcPolicyPush(session!.access_token, date, tzOffset),
    enabled: !!session,
  });

  return {
    policyPush: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
  };
};
