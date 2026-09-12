import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { updateTalk } from "../services/apiTalks";
import type { CreateTalkInput } from "../services/apiTalks";

interface UpdateTalkVariables {
  id: string;
  input: CreateTalkInput;
}

/**
 * Wraps the update-talk mutation. Same shape as `useCreateTalk`: invalidates
 * `["talks"]` on success, toasts on failure — including the server's 409 when
 * the talk has already been used in a logged safety talk.
 */
export const useUpdateTalk = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ id, input }: UpdateTalkVariables) =>
      updateTalk(session!.access_token, id, input),
    onError: (error: Error) => toast.error(error.message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["talks"] });
    },
  });

  return {
    updateTalk: mutation.mutateAsync,
    isUpdating: mutation.isPending,
  };
};
