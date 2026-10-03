import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import {
  clearMySmsOptIn,
  getMySmsOptIn,
  saveMySmsOptIn,
} from "../services/apiSms";
import type { SmsRecipient } from "../interfaces/sms";

export const SMS_OPT_IN_QUERY_KEY = ["smsOptIn"];

/**
 * The signed-in foreman's own opt-in to the Monday safety-talk reminder text
 * (Phase 9e), plus save/withdraw. Online-only, like the other settings writes.
 */
export const useMySmsOptIn = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: SMS_OPT_IN_QUERY_KEY,
    queryFn: () => getMySmsOptIn(session!.access_token),
    enabled: !!session,
  });

  const save = useMutation<SmsRecipient, Error, string>({
    networkMode: "always",
    mutationFn: (phone) => saveMySmsOptIn(session!.access_token, phone),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SMS_OPT_IN_QUERY_KEY });
      toast.success("Text reminders are on");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const clear = useMutation<void, Error, void>({
    networkMode: "always",
    mutationFn: () => clearMySmsOptIn(session!.access_token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SMS_OPT_IN_QUERY_KEY });
      toast.success("Text reminders are off");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return {
    optIn: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    saveOptIn: save.mutateAsync,
    isSaving: save.isPending,
    clearOptIn: clear.mutateAsync,
    isClearing: clear.isPending,
  };
};
