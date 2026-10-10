import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { listCrewMembers, removeCrewMember } from "../services/apiInHouseCrews";

export const crewMembersQueryKey = (crewId: string | undefined) => ["crewMembers", crewId];

/**
 * The people in one in-house crew (GC managers only), plus removing one
 * (Phase 13f-join). Removing deletes the person's sign-in account, so callers
 * confirm first. Online-only: `networkMode: "always"` makes an offline attempt
 * fail fast with a toast instead of queueing.
 */
export const useCrewMembers = (crewId: string | undefined) => {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = crewMembersQueryKey(crewId);

  const query = useQuery({
    queryKey,
    queryFn: () => listCrewMembers(session!.access_token, crewId!),
    enabled: !!session && !!crewId,
  });

  const remove = useMutation<void, Error, string>({
    networkMode: "always",
    mutationFn: (userId) => removeCrewMember(session!.access_token, crewId!, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Removed from the crew");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return {
    members: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    removeMember: remove.mutateAsync,
    isRemoving: remove.isPending,
  };
};
