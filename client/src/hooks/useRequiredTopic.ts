import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../context/auth";
import { getRequiredTopic } from "../services/apiProjects";

/**
 * A project's current required topic, if its linked GC has one pushed
 * (Phase 9e, docs/policy-push-design.md). This is a decorative, best-effort
 * nudge (the meeting wizard never blocks on it) — online-only, and any
 * failure (offline, error, still loading) simply renders as "nothing to
 * show" rather than needing a cache fallback or an error state of its own.
 */
export const useRequiredTopic = (projectId: string | undefined) => {
  const { session } = useAuth();

  const query = useQuery({
    queryKey: ["requiredTopic", projectId],
    queryFn: () => getRequiredTopic(session!.access_token, projectId!),
    enabled: !!session && !!projectId,
  });

  return {
    requiredTopic: query.data ?? null,
  };
};
