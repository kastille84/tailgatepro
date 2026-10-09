import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import {
  attachCrewToJobsite,
  createInHouseCrew,
  deleteInHouseCrew,
  inviteCrewMember,
  listInHouseCrews,
  updateInHouseCrew,
} from "../services/apiInHouseCrews";
import { JOBSITES_QUERY_KEY } from "./useJobsites";
import type {
  InHouseCrew,
  InHouseCrewPatch,
  InviteCrewMemberInput,
} from "../interfaces/inHouseCrew";
import type { InviteTeammateResult } from "../interfaces/companyInvite";
import { PlanLimitError } from "../utils/PlanLimitError";

export const IN_HOUSE_CREWS_QUERY_KEY = ["inHouseCrews"];

/** A crew changes what the job-site rosters and the GC dashboard show. */
const ROSTER_QUERY_KEYS = [JOBSITES_QUERY_KEY, ["gcOverview"]];

/**
 * The caller's GC's in-house crews (`GET /api/companies/in-house`). The query
 * is enabled for any signed-in user, so pass `enabled: false` from a caller
 * that is not a GC manager to skip the (403) request.
 */
export const useInHouseCrews = ({ enabled = true }: { enabled?: boolean } = {}) => {
  const { session } = useAuth();

  const query = useQuery({
    queryKey: IN_HOUSE_CREWS_QUERY_KEY,
    queryFn: () => listInHouseCrews(session!.access_token),
    enabled: !!session && enabled,
  });

  return {
    crews: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    /** True once the list has loaded (distinguishes "none yet" from "unknown"). */
    isLoaded: query.isSuccess,
  };
};

/**
 * The crew write actions. Online-only, no outbox: the server mints the ids and
 * sends the invite email (docs/in-house-subs-design.md), so `networkMode:
 * "always"` makes an offline attempt fail fast with a toast. A plan-limit
 * rejection is shown inline by the form (`planLimitError`), not as a toast.
 */
export const useInHouseCrewActions = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const refreshCrews = () => {
    queryClient.invalidateQueries({ queryKey: IN_HOUSE_CREWS_QUERY_KEY });
    ROSTER_QUERY_KEYS.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
  };

  const onError = (error: Error) => {
    if (error instanceof PlanLimitError) return;
    toast.error(error.message);
  };

  const create = useMutation<InHouseCrew, Error, { name: string; jobsiteIds?: string[] }>({
    networkMode: "always",
    mutationFn: (input) => createInHouseCrew(session!.access_token, input),
    onSuccess: (crew) => {
      refreshCrews();
      toast.success(`Added ${crew.name}`);
    },
    onError,
  });

  const update = useMutation<InHouseCrew, Error, { id: string; patch: InHouseCrewPatch }>({
    networkMode: "always",
    mutationFn: ({ id, patch }) => updateInHouseCrew(session!.access_token, id, patch),
    onSuccess: () => refreshCrews(),
    onError,
  });

  const remove = useMutation<void, Error, string>({
    networkMode: "always",
    mutationFn: (id) => deleteInHouseCrew(session!.access_token, id),
    onSuccess: () => {
      refreshCrews();
      toast.success("Crew deleted");
    },
    onError,
  });

  const invite = useMutation<InviteTeammateResult, Error, InviteCrewMemberInput>({
    networkMode: "always",
    mutationFn: (input) => inviteCrewMember(session!.access_token, input),
    onSuccess: (data) => {
      toast.success(`Invite sent to ${data.email}`);
    },
    onError,
  });

  const attach = useMutation<void, Error, { jobsiteId: string; crewId: string }>({
    networkMode: "always",
    mutationFn: ({ jobsiteId, crewId }) =>
      attachCrewToJobsite(session!.access_token, jobsiteId, crewId),
    onSuccess: () => {
      refreshCrews();
      toast.success("Crew added to the job site");
    },
    onError,
  });

  return {
    createCrew: create.mutateAsync,
    isCreating: create.isPending,
    createPlanLimitError: create.error instanceof PlanLimitError ? create.error : null,
    updateCrew: update.mutateAsync,
    isUpdating: update.isPending,
    deleteCrew: remove.mutateAsync,
    isDeleting: remove.isPending,
    inviteCrewMember: invite.mutateAsync,
    isInviting: invite.isPending,
    invitePlanLimitError: invite.error instanceof PlanLimitError ? invite.error : null,
    attachCrew: attach.mutateAsync,
    isAttaching: attach.isPending,
  };
};
