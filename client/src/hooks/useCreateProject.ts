import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { createProject } from "../services/apiProjects";
import type { CreateProjectInput } from "../services/apiProjects";

/**
 * Wraps the create-project mutation. Invalidates the `["projects"]` query on
 * success so the list refetches; failures surface as a toast here so every
 * caller gets consistent feedback. Exposed as `mutateAsync` so a form can await
 * it before closing its modal (mirrors `useCreateProfile`).
 */
export const useCreateProject = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (input: CreateProjectInput) =>
      createProject(session!.access_token, input),
    onError: (error: Error) => toast.error(error.message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  return {
    createProject: mutation.mutateAsync,
    isCreating: mutation.isPending,
  };
};
