import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../context/auth";
import { listNoWorkDays } from "../services/apiNoWorkDays";

/**
 * The marked days off ("Mark day off", docs/no-work-days-design.md) for one
 * project's job site: from a week back onward, soonest first. Cached under
 * `["no-work-days", projectId]`; the offline replay handler invalidates the
 * `["no-work-days"]` prefix. Disabled until a session exists.
 */
export const useNoWorkDays = (projectId: string) => {
  const { session } = useAuth();

  const query = useQuery({
    queryKey: ["no-work-days", projectId],
    queryFn: () => listNoWorkDays(session!.access_token, projectId),
    enabled: !!session,
  });

  return {
    noWorkDays: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
};
