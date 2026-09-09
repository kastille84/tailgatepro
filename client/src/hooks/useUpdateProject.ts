import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { updateProject } from "../services/apiProjects";
import type { UpdateProjectPatch } from "../services/apiProjects";

interface UpdateProjectVariables {
  id: string;
  patch: UpdateProjectPatch;
}

/**
 * Wraps the patch-project mutation. Same shape as `useCreateProject`:
 * invalidates `["projects"]` on success, toasts on failure, exposed as
 * `mutateAsync`.
 */
export const useUpdateProject = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ id, patch }: UpdateProjectVariables) =>
      updateProject(session!.access_token, id, patch),
    onError: (error: Error) => toast.error(error.message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  return {
    updateProject: mutation.mutateAsync,
    isUpdating: mutation.isPending,
  };
};
