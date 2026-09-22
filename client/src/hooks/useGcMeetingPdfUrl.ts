import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { getGcMeetingPdfUrl } from "../services/apiGc";

/**
 * Fetches a meeting's signed PDF URL on demand and opens it in a new tab.
 * Deliberately fetched on click rather than eagerly per row, so a 5-minute
 * URL never sits stale in the DOM (`docs/gc-dashboard-design.md`
 * "Client notes"). `networkMode: "always"` mirrors `useLinkProjectToGc` — a
 * click while offline fails fast and toasts instead of hanging paused.
 */
export const useGcMeetingPdfUrl = () => {
  const { session } = useAuth();

  const mutation = useMutation<string, Error, string>({
    networkMode: "always",
    mutationFn: (id) => getGcMeetingPdfUrl(session!.access_token, id),
    onSuccess: (url) => {
      window.open(url, "_blank");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return {
    openPdf: mutation.mutate,
    isPending: mutation.isPending,
  };
};
