import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { enqueueMutation } from "../utils/db/outbox";
import { createReplayer } from "../utils/db/replayRegistry";
import {
  restoreTalksQueries,
  snapshotTalksQueries,
  upsertCachedTalk,
} from "../utils/optimisticTalks";
import type { CreateTalkInput } from "../services/apiTalks";
import type { Talk } from "../interfaces/talk";

/**
 * Wraps the create-talk mutation. Every write goes through the offline
 * outbox (`docs/offline-sync-design.md`) rather than calling the API
 * directly — mirrors `useCreateProject`. Optimistically adds the new talk
 * to the cached `["talks"]` list so it appears immediately; rolled back on
 * a rejected mutation. `content` (server-composed Markdown) and `slug` are
 * unknown client-side until the write syncs and the registered replay
 * handler invalidates the query.
 */
export const useCreateTalk = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation<
    void,
    Error,
    CreateTalkInput,
    { previous: ReturnType<typeof snapshotTalksQueries> }
  >({
    // See useCreateProject.ts: without this, TanStack Query's default
    // networkMode pauses mutationFn (outbox write included) until its own
    // onlineManager sees an `online` event, instead of running immediately
    // and letting the outbox's own navigator.onLine check decide.
    networkMode: "always",
    mutationFn: (payload) =>
      enqueueMutation(
        {
          entity: "talk",
          entityId: payload.id,
          op: "create",
          // The outbox stores an arbitrary JSON payload; CreateTalkInput has
          // no index signature, so it needs an explicit cast here.
          payload: payload as unknown as Record<string, unknown>,
        },
        session ? createReplayer(session.access_token) : undefined,
      ).then(() => undefined),
    onMutate: (payload) => {
      const previous = snapshotTalksQueries(queryClient);
      const optimisticTalk: Talk = {
        id: payload.id,
        // Generated server-side — unknown until the write syncs, never read
        // in the UI before then (ContentLibrary reads `structured`).
        slug: "",
        title: payload.title,
        tradeTag: payload.tradeTag ?? null,
        tradeTags: payload.tradeTag ? [payload.tradeTag] : [],
        // Composed server-side — unknown until the write syncs, never read
        // in the UI before then (ContentLibrary reads `structured`).
        content: "",
        structured: {
          summary: payload.summary ?? null,
          talking_points: payload.talkingPoints,
          site_hazards_to_check: payload.siteHazardsToCheck ?? [],
          discussion_questions: payload.discussionQuestions ?? [],
          osha_standards: payload.oshaStandards ?? [],
          estimated_minutes: payload.estimatedMinutes ?? null,
        },
        attribution: null,
        quiz: null,
        isGlobal: false,
        // Unknown until the write syncs — never read in the UI.
        companyId: "",
        createdAt: new Date().toISOString(),
      };
      upsertCachedTalk(queryClient, optimisticTalk);
      return { previous };
    },
    onError: (error, _payload, context) => {
      if (context) restoreTalksQueries(queryClient, context.previous);
      toast.error(error.message);
    },
  });

  return {
    createTalk: (input: Omit<CreateTalkInput, "id">) =>
      mutation.mutateAsync({ id: crypto.randomUUID(), ...input }),
    isCreating: mutation.isPending,
  };
};
