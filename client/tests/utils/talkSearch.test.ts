import { describe, it, expect } from "vitest";

import { searchTalks } from "../../src/utils/talkSearch";
import type { Talk } from "../../src/interfaces/talk";

const makeTalk = (overrides: Partial<Talk> & { id: string }): Talk =>
  ({
    title: "Untitled",
    tradeTags: [],
    structured: null,
    ...overrides,
  }) as Talk;

const ladderTitle = makeTalk({ id: "title", title: "Ladder Safety" });
const tagMatch = makeTalk({ id: "tag", tradeTags: ["Ladder Crew"] });
const oshaMatch = makeTalk({
  id: "osha",
  structured: {
    osha_standards: ["1926.1053 ladders"],
    site_hazards_to_check: [],
    summary: null,
  } as unknown as Talk["structured"],
});
const hazardMatch = makeTalk({
  id: "hazard",
  structured: {
    osha_standards: [],
    site_hazards_to_check: ["Damaged ladder rails"],
    summary: null,
  } as unknown as Talk["structured"],
});
const summaryMatch = makeTalk({
  id: "summary",
  structured: {
    osha_standards: [],
    site_hazards_to_check: [],
    summary: "Inspect every ladder before climbing.",
  } as unknown as Talk["structured"],
});
const noStructured = makeTalk({ id: "none", title: "Hard Hats" });
const noTags = { id: "notags", title: "Trenching" } as Talk;

const all = [
  hazardMatch,
  summaryMatch,
  oshaMatch,
  tagMatch,
  ladderTitle,
  noStructured,
  noTags,
];

describe("searchTalks", () => {
  it("returns the talks unchanged for a blank query", () => {
    expect(searchTalks(all, "   ")).toBe(all);
  });

  it("matches title, trade tags, OSHA standards, hazards and summary", () => {
    const ids = searchTalks(all, "ladder").map((talk) => talk.id);

    expect([...ids].sort()).toEqual(["hazard", "osha", "summary", "tag", "title"]);
  });

  it("ranks title matches before tag/OSHA matches before body matches", () => {
    const ids = searchTalks(all, "ladder").map((talk) => talk.id);

    expect(ids[0]).toBe("title");
    expect(ids.slice(1, 3)).toEqual(["osha", "tag"]);
    expect(ids.slice(3)).toEqual(["hazard", "summary"]);
  });

  it("finds a talk by OSHA standard number", () => {
    expect(searchTalks(all, "1926.1053")).toEqual([oshaMatch]);
  });

  it("requires every word to match (AND) and is case-insensitive", () => {
    expect(searchTalks(all, "LADDER rails")).toEqual([hazardMatch]);
    expect(searchTalks(all, "ladder trench")).toEqual([]);
  });

  it("tolerates talks with no structured payload or trade tags", () => {
    expect(searchTalks([noStructured, noTags], "zzz")).toEqual([]);
    expect(searchTalks([noStructured, noTags], "trench")).toEqual([noTags]);
  });
});
