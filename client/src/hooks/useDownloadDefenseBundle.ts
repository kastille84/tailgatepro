import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { getDefenseBundle } from "../services/apiGc";
import { triggerBrowserDownload } from "../utils/triggerBrowserDownload";
import type { Jobsite } from "../interfaces/jobsite";

/**
 * Downloads a jobsite's OSHA Defense Bundle ZIP and saves it. `networkMode:
 * "always"` mirrors `useGcMeetingPdfUrl` — a click while offline fails fast
 * and toasts instead of hanging paused. The button that triggers this is
 * already gated on `jobsite.plan === "site_pro"` (`JobsiteList.tsx`), so a
 * `PLAN_LIMIT` 403 here is a rare race (a plan change since the page loaded)
 * rather than the normal path — a toast is enough, no inline upgrade prompt.
 */
export const useDownloadDefenseBundle = () => {
  const { session } = useAuth();

  const mutation = useMutation<void, Error, Jobsite>({
    networkMode: "always",
    mutationFn: async (jobsite) => {
      const { blob, filename } = await getDefenseBundle(session!.access_token, jobsite.id);
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
