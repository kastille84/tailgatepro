import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { enqueueMutation } from "../utils/db/outbox";
import { createReplayer } from "../utils/db/replayRegistry";
import type { CreateMeetingLogInput } from "../services/apiMeetingLogs";

/**
 * Wraps the create-meeting-log mutation, routed through the offline outbox
 * like `useCreateTalk`/`useCreateProject`. No optimistic cache update here —
 * unlike Talks/Projects, there's no `useMeetingLogs` list view yet for any
 * page to reconcile (that's a 4f/4g concern). Returns the client-generated
 * id synchronously so the wizard (4g) can move on to collecting signatures
 * against it before the write has actually synced.
 */
export const useCreateMeetingLog = () => {
  const { session } = useAuth();

  const mutation = useMutation<void, Error, CreateMeetingLogInput>({
    // See useCreateProject.ts: without this, TanStack Query's default
    // networkMode pauses mutationFn (outbox write included) until its own
    // onlineManager sees an `online` event, instead of running immediately
    // and letting the outbox's own navigator.onLine check decide.
    networkMode: "always",
    mutationFn: (payload) =>
      enqueueMutation(
        {
          entity: "meeting_log",
          entityId: payload.id,
          op: "create",
          payload: payload as unknown as Record<string, unknown>,
        },
        session ? createReplayer(session.access_token) : undefined,
      ).then(() => undefined),
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return {
    createMeetingLog: async (
      input: Omit<CreateMeetingLogInput, "id">,
    ): Promise<string> => {
      const id = crypto.randomUUID();
      await mutation.mutateAsync({ id, ...input });
      return id;
    },
    isCreating: mutation.isPending,
  };
};
