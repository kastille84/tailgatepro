import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../context/auth";
import { getJobsiteJoinLink } from "../services/apiJobsites";

/**
 * A jobsite's own standing QR/join link (Phase 9e,
 * `GET /api/jobsites/:id/join-link`), created on first ask — the same
 * lazy-create shape `useJoinCode` already uses for the company-wide code.
 * Enabled only once a session and a jobsite id are both present.
 */
export const useJobsiteJoinLink = (jobsiteId: string | undefined) => {
  const { session } = useAuth();

  const query = useQuery({
    queryKey: ["jobsiteJoinLink", jobsiteId],
    queryFn: () => getJobsiteJoinLink(session!.access_token, jobsiteId!),
    enabled: !!session && !!jobsiteId,
  });

  return {
    joinUrl: query.data?.joinUrl ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
  };
};
