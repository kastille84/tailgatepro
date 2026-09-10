import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { deleteProject } from "../services/apiProjects";

/**
 * Wraps the hard-delete mutation. Same shape as `useUpdateProject`: invalidates
 * the `["projects"]` query prefix on success, toasts on failure, exposed as
 * `mutateAsync`. The server returns a 409 ("archive it instead") when the
 * project has logged safety talks — that message surfaces through `onError`.
 */
export const useDeleteProject = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (id: string) => deleteProject(session!.access_token, id),
    onError: (error: Error) => toast.error(error.message),
    onSuccess: () => {
      toast.success("Project deleted");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  return {
    deleteProject: mutation.mutateAsync,
    isDeleting: mutation.isPending,
  };
};
