import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { addToWaitlist } from "../services/apiWaitlist";

/**
 * Wraps the waitlist signup mutation. Callers get a `joinWaitlist` function plus
 * derived success/pending flags; failures surface as a toast here so every
 * caller gets consistent error feedback.
 */
export const useWaitlist = () => {
  const mutation = useMutation({
    mutationFn: addToWaitlist, // when called, the mutation will call this function with the payload
    onError: (error: Error) => toast.error(error.message),
    onSuccess: (data) => {
      toast.success(
        `You're on the list! We'll email ${data.email} when TailgatePro launches.`,
      );
    },
  });

  return {
    joinWaitlist: mutation.mutate,
    isJoining: mutation.isPending,
    hasJoined: mutation.isSuccess,
    joinedEmail: mutation.data?.email ?? null,
  };
};
