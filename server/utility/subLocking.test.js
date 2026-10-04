// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const { computeUnlockedSubIds, isSubLocked } = require("./subLocking");

const entry = (subId, acceptedAt, sponsored = false) => ({ subId, acceptedAt, sponsored });

describe("computeUnlockedSubIds", () => {
  it("returns null (nothing locked) when the plan has no cap", () => {
    expect(computeUnlockedSubIds({ entries: [entry("a", "2026-01-01")], unlockedSubs: null })).toBeNull();
  });

  it("unlocks only the earliest-accepted sub on a cap of 1", () => {
    const unlocked = computeUnlockedSubIds({
      entries: [entry("late", "2026-03-01"), entry("early", "2026-01-01"), entry("mid", "2026-02-01")],
      unlockedSubs: 1,
    });

    expect([...unlocked]).toEqual(["early"]);
  });

  it("collapses a sub's several rows to its earliest acceptance", () => {
    const unlocked = computeUnlockedSubIds({
      entries: [entry("a", "2026-05-01"), entry("b", "2026-02-01"), entry("a", "2026-01-01")],
      unlockedSubs: 1,
    });

    expect([...unlocked]).toEqual(["a"]);
  });

  it("keeps the earlier date when a later row for the same sub comes second", () => {
    const unlocked = computeUnlockedSubIds({
      entries: [entry("a", "2026-01-01"), entry("a", "2026-05-01"), entry("b", "2026-02-01")],
      unlockedSubs: 1,
    });

    expect([...unlocked]).toEqual(["a"]);
  });

  it("breaks an acceptance-time tie by sub id", () => {
    const unlocked = computeUnlockedSubIds({
      entries: [entry("b", "2026-01-01"), entry("a", "2026-01-01")],
      unlockedSubs: 1,
    });

    expect([...unlocked]).toEqual(["a"]);
  });

  it("always unlocks a sponsored sub without using up the free slot", () => {
    const unlocked = computeUnlockedSubIds({
      entries: [entry("free-1", "2026-02-01"), entry("paid", "2026-03-01", true), entry("free-2", "2026-04-01")],
      unlockedSubs: 1,
    });

    expect([...unlocked].sort()).toEqual(["free-1", "paid"]);
  });

  it("treats a sub as sponsored if any of its rows is on a Site Pro jobsite", () => {
    const unlocked = computeUnlockedSubIds({
      entries: [entry("x", "2026-01-01"), entry("y", "2026-02-01"), entry("y", "2026-03-01", true)],
      unlockedSubs: 1,
    });

    expect([...unlocked].sort()).toEqual(["x", "y"]);
  });

  it("returns an empty set when there are no subs", () => {
    expect(computeUnlockedSubIds({ entries: [], unlockedSubs: 1 }).size).toBe(0);
  });
});

describe("isSubLocked", () => {
  it("never locks anyone when nothing is capped", () => {
    expect(isSubLocked(null, "a")).toBe(false);
  });

  it("locks a sub outside the unlocked set and not one inside it", () => {
    const unlocked = new Set(["a"]);

    expect(isSubLocked(unlocked, "a")).toBe(false);
    expect(isSubLocked(unlocked, "b")).toBe(true);
  });
});
