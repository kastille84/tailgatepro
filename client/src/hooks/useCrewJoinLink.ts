import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import {
  createCrewJoinLink,
  deleteCrewJoinLink,
  getCrewJoinLink,
} from "../services/apiInHouseCrews";
import type { CrewJoinLink } from "../interfaces/inHouseCrew";

export const crewJoinLinkQueryKey = (crewId: string | undefined) => ["crewJoinLink", crewId];

/**
 * A crew's open join link (Phase 13f-join): `null` when it has none. Making a
 * new link replaces the old one (the old URL stops working); turning it off
 * deletes it. Online-only like the other crew actions, so `networkMode:
 * "always"` makes an offline attempt fail fast with a toast.
 */
export const useCrewJoinLink = (crewId: string | undefined) => {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = crewJoinLinkQueryKey(crewId);

  const query = useQuery({
    queryKey,
    queryFn: () => getCrewJoinLink(session!.access_token, crewId!),
    enabled: !!session && !!crewId,
  });

  const onError = (error: Error) => {
    toast.error(error.message);
  };

  const create = useMutation<CrewJoinLink, Error, void>({
    networkMode: "always",
    mutationFn: () => createCrewJoinLink(session!.access_token, crewId!),
    onSuccess: (link) => {
      queryClient.setQueryData(queryKey, link);
    },
    onError,
  });

  const remove = useMutation<void, Error, void>({
    networkMode: "always",
    mutationFn: () => deleteCrewJoinLink(session!.access_token, crewId!),
    onSuccess: () => {
      queryClient.setQueryData(queryKey, null);
      toast.success("Join link turned off");
    },
    onError,
  });

  return {
    link: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    createLink: create.mutateAsync,
    isCreating: create.isPending,
    turnOff: remove.mutateAsync,
    isTurningOff: remove.isPending,
  };
};
