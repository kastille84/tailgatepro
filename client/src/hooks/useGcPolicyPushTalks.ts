import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../context/auth";
import { getGcPolicyPushTalks } from "../services/apiGc";

/**
 * Every global talk plus the GC's own company talks, for the top-down policy push picker (Phase 9e,
 * docs/policy-push-design.md). `enabled` also requires `isEnabled` so the
 * picker's list only fetches once the push form is actually open, rather
 * than on every visit to the page.
 */
export const useGcPolicyPushTalks = (isEnabled: boolean) => {
  const { session } = useAuth();

  const query = useQuery({
    queryKey: ["gcPolicyPushTalks"],
    queryFn: () => getGcPolicyPushTalks(session!.access_token),
    enabled: !!session && isEnabled,
  });

  return {
    talks: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
};
