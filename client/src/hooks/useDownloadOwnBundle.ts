import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { getDefenseBundle } from "../services/apiMeetingLogs";
import { triggerBrowserDownload } from "../utils/triggerBrowserDownload";

/**
 * Downloads the caller's own OSHA Defense Bundle ZIP and saves it — every
 * completed meeting log the company has ever logged, across every project
 * (docs/sub-defense-bundle-design.md). Mirrors `useDownloadDefenseBundle`
 * (the GC's per-jobsite version), but takes no argument: there's no
 * per-jobsite target, just the caller's own company. `networkMode: "always"`
 * for the same reason — a click while offline fails fast and toasts instead
 * of hanging paused. The button that triggers this is already gated on
 * `limits.archiveYears > 0` (`MeetingHistory.tsx`), so a `PLAN_LIMIT` 403 here
 * is a rare race (a plan change since the page loaded) rather than the normal
 * path — a toast is enough, no inline upgrade prompt.
 */
export const useDownloadOwnBundle = () => {
  const { session } = useAuth();

  const mutation = useMutation<void, Error, void>({
    networkMode: "always",
    mutationFn: async () => {
      const { blob, filename } = await getDefenseBundle(session!.access_token);
      triggerBrowserDownload(blob, filename);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return {
    downloadBundle: mutation.mutate,
    isPending: mutation.isPending,
  };
};
