import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { inviteTeammate } from "../services/apiCompanies";
import type { InviteTeammateInput, InviteTeammateResult } from "../interfaces/companyInvite";

/**
 * Sends a Phase 8c teammate invite. Mirrors `useLinkProjectToGc`:
 * `networkMode: "always"` since this needs a live server round-trip (the
 * server sends an email as a side effect) — nothing sensible to queue
 * offline, so the UI shows an offline note instead. No cache to invalidate —
 * no pending-invites list query exists this pass.
 */
export const useInviteTeammate = () => {
  const { session } = useAuth();

  const mutation = useMutation<InviteTeammateResult, Error, InviteTeammateInput>({
    networkMode: "always",
    mutationFn: (input) => inviteTeammate(session!.access_token, input),
    onSuccess: (data) => {
      toast.success(`Invite sent to ${data.email}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return {
    inviteTeammate: mutation.mutateAsync,
    isInviting: mutation.isPending,
  };
};
