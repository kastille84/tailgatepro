import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { createTalk } from "../services/apiTalks";
import type { CreateTalkInput } from "../services/apiTalks";

/**
 * Wraps the create-talk mutation. Invalidates the `["talks"]` query on
 * success so the list refetches; failures surface as a toast here so every
 * caller gets consistent feedback. Exposed as `mutateAsync` so TalkForm can
 * await it before closing its modal (mirrors useCreateProject).
 */
export const useCreateTalk = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (input: CreateTalkInput) =>
      createTalk(session!.access_token, input),
    onError: (error: Error) => toast.error(error.message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["talks"] });
    },
  });

  return {
    createTalk: mutation.mutateAsync,
    isCreating: mutation.isPending,
  };
};
