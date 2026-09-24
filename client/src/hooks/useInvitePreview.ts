import { useQuery } from "@tanstack/react-query";

import { getInvitePreview } from "../services/apiCompanies";

/**
 * The public preview for an accept-invite link (Phase 8c) — no session
 * required, since the invitee has no account yet. Disabled until a token is
 * present; `retry: false` so an invalid/expired token surfaces its error
 * state immediately rather than retrying a request that will never succeed.
 */
export const useInvitePreview = (token: string | undefined) => {
  const query = useQuery({
    queryKey: ["invitePreview", token],
    queryFn: () => getInvitePreview(token!),
    enabled: !!token,
    retry: false,
  });

  return {
    preview: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
  };
};
