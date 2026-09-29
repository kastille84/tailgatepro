import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { verifyMeetingSeal } from "../services/apiMeetingLogs";
import type { SealVerification } from "../interfaces/meetingLog";

/**
 * Verifies one meeting's tamper-evidence content seal on demand (Phase 9e).
 * Fetched on click, not per row — mirrors `useMeetingPdfUrl`: a stale
 * valid/tampered result sitting in the DOM indefinitely would be misleading
 * for a trust indicator. `networkMode: "always"` makes a click while offline
 * fail fast and toast instead of hanging paused.
 */
export const useVerifyMeetingSeal = () => {
  const { session } = useAuth();

  const mutation = useMutation<SealVerification, Error, string>({
    networkMode: "always",
    mutationFn: (id) => verifyMeetingSeal(session!.access_token, id),
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return {
    verifySeal: mutation.mutate,
    result: mutation.data,
    isPending: mutation.isPending,
    isError: mutation.isError,
    reset: mutation.reset,
    // The meeting id the current/last verify call targeted. A single
    // mutation instance is shared across a whole list (same convention as
    // useMeetingPdfUrl), so a consumer rendering several rows must compare
    // this against its own row's id before showing `result`/`isPending` —
    // otherwise one row's "Verified" would flash on every other row too.
    verifyingId: mutation.variables,
  };
};
