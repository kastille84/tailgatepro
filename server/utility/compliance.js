// Pure, I/O-free: decides per-subcontractor compliance status for a GC's
// dashboard (docs/gc-dashboard-design.md "Compliance"). Knows nothing about
// "daily", Express or Supabase — the service derives today's window and
// passes it in, so "today" -> "this week" later is a label change here, not a
// rewrite. `window` is half-open: `start` is included, `end` is excluded.
//
// `roster` is every sub expected to log in this window: `[{ subId }]`. `logs`
// is every completed meeting log that could count: `[{ subId, heldAt }]` — a
// log from a sub not on the roster is ignored (the roster, not the logs,
// drives which subs appear). A roster sub with zero matching logs is
// `missing`, the case the dashboard exists to catch.
const computeCompliance = ({ roster, logs, window }) => {
  const startMs = new Date(window.start).getTime();
  const endMs = new Date(window.end).getTime();

  const bySub = new Map();
  for (const { subId, heldAt } of logs) {
    const heldMs = new Date(heldAt).getTime();
    if (heldMs < startMs || heldMs >= endMs) continue;

    const entry = bySub.get(subId) ?? { count: 0, lastLoggedAt: null };
    entry.count += 1;
    if (entry.lastLoggedAt === null || heldAt > entry.lastLoggedAt) {
      entry.lastLoggedAt = heldAt;
    }
    bySub.set(subId, entry);
  }

  return roster.map(({ subId }) => {
    const entry = bySub.get(subId);
    return {
      subId,
      status: entry ? "logged" : "missing",
      lastLoggedAt: entry?.lastLoggedAt ?? null,
      count: entry?.count ?? 0,
    };
  });
};

module.exports = { computeCompliance };
