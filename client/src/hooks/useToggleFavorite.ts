import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { addFavorite, removeFavorite } from "../services/apiFavorites";

interface ToggleFavoriteVariables {
  talkId: string;
  /** Current state *before* the toggle: true routes to DELETE (unfavorite),
   *  false routes to POST (favorite). Named for what FavoriteButton already
   *  knows, mirroring useArchiveProject's `{ id, archived }` shape. */
  isFavorited: boolean;
}

/**
 * Wraps both favorite mutations behind one hook, picked by `isFavorited`.
 * Not split into useAddFavorite/useRemoveFavorite: unlike useDeleteProject vs
 * useArchiveProject (genuinely distinct actions with their own confirmation
 * flows), favoriting has exactly one UI affordance — one bookmark icon, one
 * click — that flips a boolean, closest in shape to useArchiveProject's own
 * boolean-branch mutation. No success toast (mirrors useCreateProject /
 * useUpdateProject, not useDeleteProject / useArchiveProject): this is a
 * frequent, low-consequence tap, and the icon flipping state is feedback
 * enough — a toast on every tap would be noisy.
 */
export const useToggleFavorite = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ talkId, isFavorited }: ToggleFavoriteVariables) =>
      isFavorited
        ? removeFavorite(session!.access_token, talkId)
        : addFavorite(session!.access_token, talkId),
    onError: (error: Error) => toast.error(error.message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
  });

  return {
    toggleFavorite: mutation.mutateAsync,
    isToggling: mutation.isPending,
  };
};
