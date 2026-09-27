// GC Free unlocks only `unlockedSubs` subcontractors (Phase 9d); the rest are
// "locked" -- visible as a count but with their name, status and PDFs hidden.
// Pure: takes one entry per accepted roster row and decides who stays unlocked.
//
// entry = { subId, acceptedAt, sponsored }. A sub can hold several rows (one per
// jobsite), so entries are collapsed per sub first: earliest `acceptedAt`, and
// sponsored if any row is on a Site Pro jobsite. Sponsored subs are always
// unlocked and don't use up a slot; the earliest-accepted `unlockedSubs` of the
// rest are unlocked (tie-break: subId, so the result is deterministic).
//
// Returns null when the plan has no cap (`unlockedSubs === null`, everyone
// unlocked), else the Set of unlocked sub company ids.
const computeUnlockedSubIds = ({ entries, unlockedSubs }) => {
  if (unlockedSubs === null) return null;

  const bySub = new Map();
  for (const { subId, acceptedAt, sponsored } of entries) {
    const known = bySub.get(subId);
    if (!known) {
      bySub.set(subId, { subId, acceptedAt, sponsored });
      continue;
    }
    if (acceptedAt < known.acceptedAt) known.acceptedAt = acceptedAt;
    known.sponsored = known.sponsored || sponsored;
  }

  const subs = [...bySub.values()];
  const unlocked = new Set(subs.filter((sub) => sub.sponsored).map((sub) => sub.subId));
  subs
    .filter((sub) => !sub.sponsored)
    .sort((a, b) => a.acceptedAt.localeCompare(b.acceptedAt) || a.subId.localeCompare(b.subId))
    .slice(0, unlockedSubs)
    .forEach((sub) => unlocked.add(sub.subId));
  return unlocked;
};

// `unlocked` is the result of computeUnlockedSubIds (null = nothing locked).
const isSubLocked = (unlocked, subId) => unlocked !== null && !unlocked.has(subId);

module.exports = { computeUnlockedSubIds, isSubLocked };
