import { useQuery } from "@tanstack/react-query";

import { getJobsiteInvitePreview } from "../services/apiJobsites";

/**
 * The public preview for a jobsite-invite link (Phase 8d) — no session
 * required, since the invitee may have no account yet. Disabled until a token
 * is present; `retry: false` so an invalid/expired token surfaces its error
 * state immediately.
 */
export const useJobsiteInvitePreview = (token: string | undefined) => {
  const query = useQuery({
    queryKey: ["jobsiteInvitePreview", token],
    queryFn: () => getJobsiteInvitePreview(token!),
    enabled: !!token,
    retry: false,
  });

  return {
    preview: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
  };
};
