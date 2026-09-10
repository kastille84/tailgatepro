import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { updateProject } from "../services/apiProjects";

interface ArchiveProjectVariables {
  id: string;
  /** `true` archives the project, `false` restores it. */
  archived: boolean;
}

/**
 * Wraps archive / restore, which ride on `PATCH /api/projects/:id` via the
 * `archived` flag. Kept separate from `useUpdateProject` so it can own its own
 * success toast (archived vs restored) while sharing the `["projects"]`
 * invalidation and error-toast pattern.
 */
export const useArchiveProject = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ id, archived }: ArchiveProjectVariables) =>
      updateProject(session!.access_token, id, { archived }),
    onError: (error: Error) => toast.error(error.message),
    onSuccess: (_data, { archived }) => {
      toast.success(archived ? "Project archived" : "Project restored");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  return {
    archiveProject: mutation.mutateAsync,
    isArchiving: mutation.isPending,
  };
};
