import { describe, it, expect } from "vitest";

import {
  isOwnTalk,
  talkOriginLabel,
} from "../../../src/features/content-library/talkOwnership";
import type { Talk } from "../../../src/interfaces/talk";

const talk = (overrides: Partial<Talk>): Talk => ({
  id: "t1",
  slug: "s",
  title: "T",
  tradeTag: null,
  tradeTags: [],
  content: "",
  structured: null,
  attribution: null,
  quiz: null,
  translations: null,
  isGlobal: false,
  companyId: "company-1",
  createdAt: "2026-09-09T00:00:00.000Z",
  ...overrides,
});

describe("isOwnTalk", () => {
  it("is false for a global library talk", () => {
    expect(isOwnTalk(talk({ isGlobal: true, companyId: null }), "company-1")).toBe(false);
  });

  it("is true for the caller's own company talk", () => {
    expect(isOwnTalk(talk({}), "company-1")).toBe(true);
  });

  it("is false for another company's talk (a GC's shared talk)", () => {
    expect(isOwnTalk(talk({ companyId: "gc-1" }), "company-1")).toBe(false);
  });

  it("is true for an optimistic just-created talk (companyId not yet known)", () => {
    expect(isOwnTalk(talk({ companyId: "" }), "company-1")).toBe(true);
  });

  it("is permissive while the caller's company is unknown (loading or offline)", () => {
    expect(isOwnTalk(talk({ companyId: "gc-1" }), null)).toBe(true);
  });
});

describe("talkOriginLabel", () => {
  it("has no label for a global talk", () => {
    expect(talkOriginLabel(talk({ isGlobal: true, companyId: null }), "company-1")).toBeNull();
  });

  it("labels the caller's own talk Custom", () => {
    expect(talkOriginLabel(talk({}), "company-1")).toBe("Custom");
  });

  it("labels a GC's shared talk From your GC", () => {
    expect(talkOriginLabel(talk({ companyId: "gc-1" }), "company-1")).toBe("From your GC");
  });
});
