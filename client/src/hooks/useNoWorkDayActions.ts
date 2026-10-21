import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { enqueueMutation } from "../utils/db/outbox";
import { createReplayer } from "../utils/db/replayRegistry";
import type { CreateNoWorkDayInput } from "../services/apiNoWorkDays";
import type { NoWorkDay } from "../interfaces/noWorkDay";

interface RemoveInput {
  id: string;
  projectId: string;
}

type Cached = NoWorkDay[] | undefined;

/**
 * Mark / un-mark a day off, routed through the offline outbox like the other
 * foreman writes (docs/offline-sync-design.md): `enqueueMutation` durably
 * queues the change and flushes it at once when online. Each row depends on
 * the project's own `entityId`, so a mark made against a still-unsynced
 * project waits for it. The sheet's cached list is updated optimistically (so
 * an offline mark shows immediately) and rolled back if the write is rejected;
 * the replay handler invalidates it once the write really lands.
 */
export const useNoWorkDayActions = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const replay = () =>
    session ? createReplayer(session.access_token) : undefined;
  const keyFor = (projectId: string) => ["no-work-days", projectId];

  const markMutation = useMutation<
    void,
    Error,
    CreateNoWorkDayInput,
    { previous: Cached }
  >({
    // See useCreateProject.ts: let the outbox's own navigator.onLine check
    // decide instead of TanStack Query pausing the local write while offline.
    networkMode: "always",
    mutationFn: (payload) =>
      enqueueMutation(
        {
          entity: "no_work_day",
          entityId: payload.id,
          op: "create",
          payload: payload as unknown as Record<string, unknown>,
          dependsOnEntityIds: [payload.projectId],
        },
        replay(),
      ).then(() => undefined),
    onMutate: async (payload) => {
      const key = keyFor(payload.projectId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<NoWorkDay[]>(key);
      const optimistic: NoWorkDay = {
        id: payload.id,
        // Unknown client-side; filled in when the write syncs and the list refetches.
        jobsiteId: "",
        companyId: "",
        offDate: payload.offDate,
        reason: payload.reason,
        createdBy: null,
        createdAt: new Date().toISOString(),
      };
      queryClient.setQueryData<NoWorkDay[]>(key, (current = []) =>
        [...current, optimistic].sort((a, b) =>
          a.offDate.localeCompare(b.offDate),
        ),
      );
      return { previous };
    },
    onError: (error, payload, context) => {
      queryClient.setQueryData(keyFor(payload.projectId), context?.previous);
      toast.error(error.message);
    },
  });

  const removeMutation = useMutation<
    void,
    Error,
    RemoveInput,
    { previous: Cached }
  >({
    networkMode: "always",
    mutationFn: ({ id, projectId }) =>
      enqueueMutation(
        {
          entity: "no_work_day",
          entityId: id,
          op: "delete",
          payload: {},
          dependsOnEntityIds: [projectId],
        },
        replay(),
      ).then(() => undefined),
    onMutate: async ({ id, projectId }) => {
      const key = keyFor(projectId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<NoWorkDay[]>(key);
      queryClient.setQueryData<NoWorkDay[]>(key, (current = []) =>
        current.filter((day) => day.id !== id),
      );
      return { previous };
    },
    onError: (error, { projectId }, context) => {
      queryClient.setQueryData(keyFor(projectId), context?.previous);
      toast.error(error.message);
    },
  });

  return {
    markDayOff: (input: Omit<CreateNoWorkDayInput, "id">) =>
      markMutation.mutateAsync({ id: crypto.randomUUID(), ...input }),
    removeDayOff: (input: RemoveInput) => removeMutation.mutateAsync(input),
    isMarking: markMutation.isPending,
    isRemoving: removeMutation.isPending,
  };
};
