import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";

import {
  applyTalkPatch,
  findCachedTalk,
  removeCachedTalk,
  restoreTalksQueries,
  snapshotTalksQueries,
  upsertCachedTalk,
} from "../../src/utils/optimisticTalks";
import type { Talk } from "../../src/interfaces/talk";

const talk = (overrides: Partial<Talk> = {}): Talk => ({
  id: "talk-1",
  slug: "eye-protection",
  title: "Eye Protection on the Jobsite",
  tradeTag: "General Construction",
  tradeTags: ["General Construction"],
  content: "# Eye Protection on the Jobsite\n",
  structured: {
    summary: "Keep debris out of your eyes.",
    talking_points: ["Wear safety glasses"],
    site_hazards_to_check: ["Grinding nearby"],
    discussion_questions: ["When do you need a face shield?"],
    osha_standards: ["29 CFR 1926.102"],
    estimated_minutes: 5,
  },
  attribution: null,
  isGlobal: false,
  companyId: "company-1",
  createdAt: "2026-09-13T00:00:00.000Z",
  ...overrides,
});

describe("optimisticTalks", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
  });

  const seed = (data: Talk[]) => queryClient.setQueryData(["talks"], data);

  describe("applyTalkPatch", () => {
    it("full-replaces every editable field from the patch", () => {
      const patched = applyTalkPatch(talk(), {
        title: "New title",
        tradeTag: "Roofing",
        summary: "New summary",
        talkingPoints: ["New point"],
        siteHazardsToCheck: ["New hazard"],
        discussionQuestions: ["New question"],
        oshaStandards: ["29 CFR 1926.1053"],
        estimatedMinutes: 10,
      });

      expect(patched).toEqual(
        talk({
          title: "New title",
          tradeTag: "Roofing",
          tradeTags: ["Roofing"],
          structured: {
            summary: "New summary",
            talking_points: ["New point"],
            site_hazards_to_check: ["New hazard"],
            discussion_questions: ["New question"],
            osha_standards: ["29 CFR 1926.1053"],
            estimated_minutes: 10,
          },
        }),
      );
    });

    it("defaults tradeTag/tradeTags to null/[] when tradeTag is omitted", () => {
      const patched = applyTalkPatch(talk(), {
        title: "T",
        talkingPoints: ["p"],
      });
      expect(patched.tradeTag).toBeNull();
      expect(patched.tradeTags).toEqual([]);
    });

    it("defaults summary to null when omitted", () => {
      const patched = applyTalkPatch(talk(), {
        title: "T",
        talkingPoints: ["p"],
      });
      expect(patched.structured?.summary).toBeNull();
    });

    it("defaults each optional list to [] when omitted", () => {
      const patched = applyTalkPatch(talk(), {
        title: "T",
        talkingPoints: ["p"],
      });
      expect(patched.structured?.site_hazards_to_check).toEqual([]);
      expect(patched.structured?.discussion_questions).toEqual([]);
      expect(patched.structured?.osha_standards).toEqual([]);
    });

    it("defaults estimatedMinutes to null when omitted", () => {
      const patched = applyTalkPatch(talk(), {
        title: "T",
        talkingPoints: ["p"],
      });
      expect(patched.structured?.estimated_minutes).toBeNull();
    });

    it("leaves id/slug/attribution/isGlobal/companyId/createdAt untouched", () => {
      const patched = applyTalkPatch(talk(), {
        title: "T",
        talkingPoints: ["p"],
      });
      expect(patched).toMatchObject({
        id: "talk-1",
        slug: "eye-protection",
        attribution: null,
        isGlobal: false,
        companyId: "company-1",
        createdAt: "2026-09-13T00:00:00.000Z",
      });
    });
  });

  describe("upsertCachedTalk", () => {
    it("appends a new talk to the cached list", () => {
      seed([]);
      upsertCachedTalk(queryClient, talk());
      expect(queryClient.getQueryData(["talks"])).toEqual([talk()]);
    });

    it("replaces an existing talk with the same id in place, leaving others untouched", () => {
      const other = talk({ id: "talk-2", title: "Other talk" });
      seed([talk({ title: "old title" }), other]);

      upsertCachedTalk(queryClient, talk({ title: "new title" }));

      expect(queryClient.getQueryData(["talks"])).toEqual([
        talk({ title: "new title" }),
        other,
      ]);
    });

    it("leaves a query with no cached data (never fetched) untouched", () => {
      expect(queryClient.getQueryData(["talks"])).toBeUndefined();
      upsertCachedTalk(queryClient, talk());
      expect(queryClient.getQueryData(["talks"])).toBeUndefined();
    });

    it("skips a query that exists in the cache but has no data yet (e.g. still loading)", () => {
      queryClient.getQueryCache().build(queryClient, {
        queryKey: ["talks"],
      });

      expect(() => upsertCachedTalk(queryClient, talk())).not.toThrow();
      expect(queryClient.getQueryData(["talks"])).toBeUndefined();
    });
  });

  describe("removeCachedTalk", () => {
    it("removes the talk from the cached list", () => {
      seed([talk()]);
      removeCachedTalk(queryClient, "talk-1");
      expect(queryClient.getQueryData(["talks"])).toEqual([]);
    });

    it("skips a query that exists in the cache but has no data yet", () => {
      queryClient.getQueryCache().build(queryClient, {
        queryKey: ["talks"],
      });

      expect(() => removeCachedTalk(queryClient, "talk-1")).not.toThrow();
    });
  });

  describe("findCachedTalk", () => {
    it("finds a cached talk by id", () => {
      seed([talk()]);
      expect(findCachedTalk(queryClient, "talk-1")).toEqual(talk());
    });

    it("returns undefined when nothing is cached", () => {
      seed([]);
      expect(findCachedTalk(queryClient, "missing")).toBeUndefined();
    });
  });

  describe("snapshotTalksQueries / restoreTalksQueries", () => {
    it("restores the query to its snapshotted value", () => {
      seed([talk()]);
      const snapshot = snapshotTalksQueries(queryClient);

      upsertCachedTalk(queryClient, talk({ title: "changed" }));
      expect(queryClient.getQueryData(["talks"])).toEqual([
        talk({ title: "changed" }),
      ]);

      restoreTalksQueries(queryClient, snapshot);
      expect(queryClient.getQueryData(["talks"])).toEqual([talk()]);
    });
  });
});
