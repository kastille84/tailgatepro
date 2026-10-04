import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { getMeetingPdfUrl } from "../services/apiMeetingLogs";

/**
 * Fetches a meeting's signed PDF URL on demand and opens it in a new tab.
 * Fetched on click, not per row, so a 5-minute URL never sits stale in the
 * DOM. Mirrors `useGcMeetingPdfUrl`; `networkMode: "always"` makes a click
 * while offline fail fast and toast instead of hanging paused.
 */
export const useMeetingPdfUrl = () => {
  const { session } = useAuth();

  const mutation = useMutation<string, Error, string>({
    networkMode: "always",
    mutationFn: (id) => getMeetingPdfUrl(session!.access_token, id),
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
