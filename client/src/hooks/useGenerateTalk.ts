import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { useOnlineStatus } from "../context/online-status";
import { useCurrentUser } from "./useCurrentUser";
import {
  generateTalkDraft,
  getAiTalkUsage,
  type GenerateTalkInput,
  type GenerateTalkResult,
} from "../services/apiTalkGeneration";

const USAGE_KEY = ["aiTalkUsage"];

/**
 * AI Talk Builder (docs/ai-talk-builder-design.md): drafts a talk from a topic
 * and tracks this month's allowance. Online-only by nature — there is no
 * offline path, so this deliberately bypasses the outbox. The draft is never
 * saved here; `TalkForm` pre-fills itself with it and the normal create flow
 * does the save. `hasAccess`/`isOnline` gate the whole panel; the server
 * enforces plan and cap regardless.
 */
export const useGenerateTalk = () => {
  const { session } = useAuth();
  const { isOnline } = useOnlineStatus();
  const { hasAiTalkBuilderAccess } = useCurrentUser();
  const queryClient = useQueryClient();

  const usageQuery = useQuery({
    queryKey: USAGE_KEY,
    queryFn: () => getAiTalkUsage(session!.access_token),
    enabled: !!session && isOnline && hasAiTalkBuilderAccess,
  });

  const mutation = useMutation<GenerateTalkResult, Error, GenerateTalkInput>({
    mutationFn: (input) => generateTalkDraft(session!.access_token, input),
    onSuccess: ({ usage }) => {
      queryClient.setQueryData(USAGE_KEY, usage);
    },
    onError: (error) => {
      toast.error(error.message);
      // A 429 means our cached count was stale; re-read the real one.
      queryClient.invalidateQueries({ queryKey: USAGE_KEY });
    },
  });

  return {
    generateDraft: mutation.mutateAsync,
    isGenerating: mutation.isPending,
    usage: usageQuery.data ?? null,
    hasAccess: hasAiTalkBuilderAccess,
    isOnline,
  };
};
