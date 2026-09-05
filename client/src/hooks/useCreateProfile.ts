import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { createProfile } from "../services/apiUsers";

/**
 * Wraps the signup profile-creation mutation. `createProfile` is exposed as
 * `mutateAsync` (not `mutate`) because the Signup page needs to await it
 * before navigating to /dashboard.
 */
export const useCreateProfile = () => {
  const mutation = useMutation({
    mutationFn: createProfile,
    onError: (error: Error) => toast.error(error.message),
  });

  return {
    createProfile: mutation.mutateAsync,
    isCreating: mutation.isPending,
  };
};
