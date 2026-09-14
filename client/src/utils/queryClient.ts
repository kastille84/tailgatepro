import { QueryClient } from "@tanstack/react-query";

/**
 * The app's single TanStack Query client. Pulled out of `App.tsx` (which
 * still passes it to `QueryClientProvider`) so non-component code can reach
 * the same cache — specifically, `services/projectReplayHandler.ts` invalidates
 * `["projects"]` once a queued write actually lands on the server, regardless
 * of what triggered that flush (the mutation itself, the `online` event, a
 * manual retry, or the backstop poll — see `docs/offline-sync-design.md`).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 0,
    },
  },
});
