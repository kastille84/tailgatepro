// Pure, I/O-free: decides what `meeting_logs.held_at` gets written when a
// meeting is completed. `held_at` is the client-reported time the meeting was
// actually held (see docs/gc-dashboard-design.md) — `completed_at` is stamped
// at server receipt, so an offline meeting synced the next day would otherwise
// be filed under the wrong day.
//
// A client-supplied time is trusted only inside a window around "now": a
// little into the future (a phone clock running fast) and up to a week into
// the past (a crew offline over a long weekend). Anything outside it — or
// missing, or unparseable — falls back to the server's own receipt time.
// It deliberately never throws: the completion arrives through the client's
// offline outbox, which retries a failed row forever with the same payload, so
// rejecting a stale `heldAt` would leave a fully-signed meeting permanently
// un-completed (no PDF, invisible to the GC). Falling back always lets the
// completion succeed, and `completed_at` remains as the server-side evidence.
const HELD_AT_MAX_FUTURE_MS = 5 * 60 * 1000;
const HELD_AT_MAX_PAST_MS = 7 * 24 * 60 * 60 * 1000;

const resolveHeldAt = ({ heldAt, now }) => {
  const receivedAt = now.getTime();
  const reported = typeof heldAt === "string" ? new Date(heldAt).getTime() : NaN;

  if (
    Number.isNaN(reported) ||
    reported > receivedAt + HELD_AT_MAX_FUTURE_MS ||
    reported < receivedAt - HELD_AT_MAX_PAST_MS
  ) {
    return now.toISOString();
  }

  return new Date(reported).toISOString();
};

module.exports = {
  resolveHeldAt,
  HELD_AT_MAX_FUTURE_MS,
  HELD_AT_MAX_PAST_MS,
};
