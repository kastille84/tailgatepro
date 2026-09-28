import { useQuery } from "@tanstack/react-query";

import { getJobsiteJoinPreview } from "../services/apiJobsites";

/**
 * The public preview for a jobsite QR/join link (Phase 9e) — no session
 * required, since the scanner may have no account yet. Disabled until a token
 * is present; `retry: false` so an invalid token surfaces its error state
 * immediately. Mirrors `useJobsiteInvitePreview`.
 */
export const useJoinLinkPreview = (token: string | undefined) => {
  const query = useQuery({
    queryKey: ["jobsiteJoinPreview", token],
    queryFn: () => getJobsiteJoinPreview(token!),
    enabled: !!token,
    retry: false,
  });

  return {
    preview: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
  };
};
