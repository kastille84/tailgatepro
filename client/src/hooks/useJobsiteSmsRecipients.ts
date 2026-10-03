import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import {
  addJobsiteSmsRecipient,
  listJobsiteSmsRecipients,
  removeJobsiteSmsRecipient,
} from "../services/apiSms";
import type { SmsRecipient } from "../interfaces/sms";
import { PlanLimitError } from "../utils/PlanLimitError";

interface AddVariables {
  rosterId: string;
  phone: string;
}

/**
 * The phone numbers a GC has entered for one jobsite's Monday SMS nudge
 * (Phase 9e), plus add/remove. Enabled only with a session and a jobsite id
 * (the caller passes `undefined` when the site is not on Site Pro, which the
 * server would reject anyway).
 */
export const useJobsiteSmsRecipients = (jobsiteId: string | undefined) => {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["jobsiteSmsRecipients", jobsiteId];

  const query = useQuery({
    queryKey,
    queryFn: () => listJobsiteSmsRecipients(session!.access_token, jobsiteId!),
    enabled: !!session && !!jobsiteId,
  });

  const add = useMutation<SmsRecipient, Error, AddVariables>({
    networkMode: "always",
    mutationFn: (input) =>
      addJobsiteSmsRecipient(session!.access_token, jobsiteId!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Number added. We texted them a confirmation request.");
    },
    onError: (error) => {
      // A not-on-Site-Pro rejection is explained inline by the panel.
      if (error instanceof PlanLimitError) return;
      toast.error(error.message);
    },
  });

  const remove = useMutation<void, Error, string>({
    networkMode: "always",
    mutationFn: (recipientId) =>
      removeJobsiteSmsRecipient(session!.access_token, jobsiteId!, recipientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return {
    recipients: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    addRecipient: add.mutateAsync,
    isAdding: add.isPending,
    removeRecipient: remove.mutateAsync,
    isRemoving: remove.isPending,
  };
};
