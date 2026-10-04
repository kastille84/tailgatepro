/**
 * `fetch`, bounded by a timeout. Plain `fetch()` has no default timeout — a
 * request that's accepted but never answered (a captive portal, some VPN/
 * proxy failure modes, or Chrome DevTools' Network "Offline" throttle, which
 * blocks requests without flipping `navigator.onLine`) hangs forever instead
 * of rejecting. That hang is what caused the offline write-queue's `flush`
 * to wedge permanently — see `docs/offline-sync-design.md`.
 *
 * On timeout this rejects with the `AbortController`'s abort error (named
 * `"AbortError"`), distinct from the `TypeError` a genuine network failure
 * rejects with, and both distinct from an application-level error thrown
 * only after a response is actually received (see callers in
 * `services/apiProjects.ts` and the discard-vs-retry check in
 * `utils/db/outbox.ts`).
 */
export const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

export const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};
