import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { deleteTalk } from "../services/apiTalks";

/**
 * Wraps the hard-delete mutation. Same shape as `useDeleteProject`: invalidates
 * the `["talks"]` query on success, toasts on failure — including the server's
 * 409 when the talk has already been used in a logged safety talk.
 */
export const useDeleteTalk = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (id: string) => deleteTalk(session!.access_token, id),
    onError: (error: Error) => toast.error(error.message),
    onSuccess: () => {
      toast.success("Talk deleted");
      queryClient.invalidateQueries({ queryKey: ["talks"] });
    },
  });

  return {
    deleteTalk: mutation.mutateAsync,
    isDeleting: mutation.isPending,
  };
};
