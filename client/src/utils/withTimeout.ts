/**
 * Races a promise against a timer. Unlike `fetchWithTimeout.ts` (which
 * genuinely aborts the underlying request via `AbortController`), this
 * cannot cancel the wrapped operation — Dexie/IndexedDB has no cancellation
 * primitive for an in-flight request. If the timer wins, the caller gets an
 * answer (a rejection) within a bounded time, but the original operation may
 * still be pending in the background; this unblocks the UI, it doesn't stop
 * the underlying work.
 *
 * Exists because a native IndexedDB request can go silently unanswered
 * forever — e.g. a connection blocked by another open tab — with nothing in
 * this codebase to detect or bound that. See
 * `docs/offline-sync-design.md`'s addenda for the repro this fixes.
 */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

export const withTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number,
  message = "Operation timed out",
): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(message)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
