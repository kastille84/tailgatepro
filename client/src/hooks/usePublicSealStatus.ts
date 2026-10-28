import { useQuery } from "@tanstack/react-query";

import { getPublicSealStatus } from "../services/apiPublicVerify";

/**
 * The public verify page's record check. Each fetch is recorded server-side
 * as a seal_verified audit event, so it must not silently re-run on window
 * focus or retry on a 404 (an unsealed meeting is a final answer).
 */
export const usePublicSealStatus = (meetingId: string | undefined) => {
  const query = useQuery({
    queryKey: ["public-seal-status", meetingId],
    queryFn: () => getPublicSealStatus(meetingId!),
    enabled: !!meetingId,
    refetchOnWindowFocus: false,
    retry: false,
    networkMode: "always",
  });

  return {
    status: query.data,
    isLoading: query.isLoading,
    error: query.error,
  };
};
