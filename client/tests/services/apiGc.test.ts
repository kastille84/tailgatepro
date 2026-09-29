import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getGcOverview,
  getGcMeetings,
  getGcMeetingById,
  getGcMeetingPdfUrl,
  verifyGcMeetingSeal,
  getDefenseBundle,
  getGcSubcontractorScorecards,
  getGcSubcontractorScorecard,
  getGcPolicyPush,
  getGcPolicyPushTalks,
  pushGcPolicyTopic,
  clearGcPolicyPush,
} from "../../src/services/apiGc";
import { PlanLimitError } from "../../src/utils/PlanLimitError";

const GENERIC = "Something went wrong. Please try again.";

const overview = {
  jobsites: [{ id: "jobsite-1", name: "Downtown Tower", subs: [] }],
  totals: { subs: 0, logged: 0, missing: 0 },
};

const meeting = {
  id: "meeting-1",
  projectId: "project-1",
  projectName: "Downtown Tower",
  companyId: "sub-1",
  companyName: "Rivera Electric",
  talkTitle: "Fall Protection",
  heldAt: "2026-09-21T13:00:00.000Z",
  completedAt: "2026-09-21T13:05:00.000Z",
  signerCount: 2,
  pdfReady: true,
};

describe("apiGc", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("getGcOverview", () => {
    it("GETs /api/gc/overview with the date and tzOffset query params", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: overview }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        getGcOverview("token-123", "2026-09-21", 300),
      ).resolves.toEqual(overview);
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/gc/overview?date=2026-09-21&tzOffset=300",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({ Authorization: "Bearer token-123" }),
        }),
      );
    });

    it("rejects with the backend error message on a 403 (not a GC)", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          json: async () => ({
            success: false,
            error: "This is only available to general contractor accounts",
          }),
        }),
      );
      await expect(
        getGcOverview("token-123", "2026-09-21", 300),
      ).rejects.toThrow("This is only available to general contractor accounts");
    });

    it("rejects with the generic message when JSON parsing fails", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => {
            throw new Error("bad json");
          },
        }),
      );
      await expect(
        getGcOverview("token-123", "2026-09-21", 300),
      ).rejects.toThrow(GENERIC);
    });
  });

  describe("getGcMeetings", () => {
    const page = { meetings: [meeting], hasMore: false };

    it("GETs /api/gc/meetings with no query string when no filters are given", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: page }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(getGcMeetings("token-123")).resolves.toEqual(page);
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/gc/meetings",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("builds a query string from only the provided filters", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: page }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await getGcMeetings("token-123", { projectId: "project-1" });

      expect(fetchMock).toHaveBeenCalledWith(
        "/api/gc/meetings?projectId=project-1",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("includes every provided filter in the query string, including limit/offset", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { meetings: [], hasMore: false } }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await getGcMeetings("token-123", {
        projectId: "project-1",
        from: "2026-09-01T00:00:00.000Z",
        to: "2026-09-21T00:00:00.000Z",
        limit: 20,
        offset: 40,
      });

      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain("projectId=project-1");
      expect(url).toContain("from=2026-09-01T00%3A00%3A00.000Z");
      expect(url).toContain("to=2026-09-21T00%3A00%3A00.000Z");
      expect(url).toContain("limit=20");
      expect(url).toContain("offset=40");
    });

    it("rejects with the generic message when the response is unsuccessful without a body", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          json: async () => null,
        }),
      );
      await expect(getGcMeetings("token-123")).rejects.toThrow(GENERIC);
    });

    it("rejects with the backend error message when the response carries one", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          json: async () => ({
            success: false,
            error: "This is only available to general contractor accounts",
          }),
        }),
      );
      await expect(getGcMeetings("token-123")).rejects.toThrow(
        "This is only available to general contractor accounts",
      );
    });
  });

  describe("getGcMeetingById", () => {
    it("GETs /api/gc/meetings/:id and returns the detail", async () => {
      const detail = { ...meeting, signers: [{ workerName: "Sam", quizPassed: true }] };
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: detail }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(getGcMeetingById("token-123", "meeting-1")).resolves.toEqual(
        detail,
      );
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/gc/meetings/meeting-1",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("rejects with the backend error message on a 404", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          json: async () => ({ success: false, error: "Meeting not found" }),
        }),
      );
      await expect(
        getGcMeetingById("token-123", "unknown"),
      ).rejects.toThrow("Meeting not found");
    });

    it("rejects with the generic message when the response is unsuccessful without a body", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          json: async () => null,
        }),
      );
      await expect(
        getGcMeetingById("token-123", "meeting-1"),
      ).rejects.toThrow(GENERIC);
    });
  });

  describe("getGcMeetingPdfUrl", () => {
    it("GETs /api/gc/meetings/:id/pdf-url and returns the signed url", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { url: "https://signed.example/meeting.pdf" },
        }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        getGcMeetingPdfUrl("token-123", "meeting-1"),
      ).resolves.toBe("https://signed.example/meeting.pdf");
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/gc/meetings/meeting-1/pdf-url",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("rejects with the backend error message on a 404 (PDF not ready)", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          json: async () => ({
            success: false,
            error: "No PDF has been generated for this meeting yet",
          }),
        }),
      );
      await expect(
        getGcMeetingPdfUrl("token-123", "meeting-1"),
      ).rejects.toThrow("No PDF has been generated for this meeting yet");
    });

    it("rejects with the generic message when the response is unsuccessful without a body", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          json: async () => null,
        }),
      );
      await expect(
        getGcMeetingPdfUrl("token-123", "meeting-1"),
      ).rejects.toThrow(GENERIC);
    });
  });

  describe("verifyGcMeetingSeal", () => {
    it("GETs /api/gc/meetings/:id/verify-seal and returns the result", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { valid: false, sealedAt: "2026-09-21T13:05:00.000Z" },
        }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        verifyGcMeetingSeal("token-123", "meeting-1"),
      ).resolves.toEqual({ valid: false, sealedAt: "2026-09-21T13:05:00.000Z" });
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/gc/meetings/meeting-1/verify-seal",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("rejects with the backend error message when the meeting hasn't been sealed yet", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          json: async () => ({
            success: false,
            error: "This meeting hasn't been sealed yet",
          }),
        }),
      );
      await expect(
        verifyGcMeetingSeal("token-123", "meeting-1"),
      ).rejects.toThrow("This meeting hasn't been sealed yet");
    });

    it("rejects with the generic message when the response is unsuccessful without a body", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          json: async () => null,
        }),
      );
      await expect(
        verifyGcMeetingSeal("token-123", "meeting-1"),
      ).rejects.toThrow(GENERIC);
    });
  });

  describe("getGcSubcontractorScorecards", () => {
    const scorecards = [
      { companyId: "sub-1", companyName: "Rivera Electric", overallScore: 87 },
    ];

    it("GETs /api/gc/subcontractors with the date and tzOffset query params", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: scorecards }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        getGcSubcontractorScorecards("token-123", "2026-09-21", 300),
      ).resolves.toEqual(scorecards);
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/gc/subcontractors?date=2026-09-21&tzOffset=300",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({ Authorization: "Bearer token-123" }),
        }),
      );
    });

    it("rejects with a PlanLimitError on a 403 PLAN_LIMIT (not GC Portfolio)", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          json: async () => ({
            success: false,
            error: "Cross-project subcontractor scorecards are part of GC Portfolio. Upgrade to use them.",
            data: { code: "PLAN_LIMIT" },
          }),
        }),
      );

      const error = await getGcSubcontractorScorecards("token-123", "2026-09-21", 300).catch(
        (e) => e,
      );
      expect(error).toBeInstanceOf(PlanLimitError);
      expect(error.message).toBe(
        "Cross-project subcontractor scorecards are part of GC Portfolio. Upgrade to use them.",
      );
      expect(error.limit).toBeNull();
    });

    it("carries a limit when a PLAN_LIMIT response has one", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          json: async () => ({ success: false, data: { code: "PLAN_LIMIT", limit: 1 } }),
        }),
      );

      const error = await getGcSubcontractorScorecards("token-123", "2026-09-21", 300).catch(
        (e) => e,
      );
      expect(error).toBeInstanceOf(PlanLimitError);
      expect(error.limit).toBe(1);
    });

    it("rejects with the backend error message on a non-PLAN_LIMIT failure", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          json: async () => ({
            success: false,
            error: "This is only available to general contractor accounts",
          }),
        }),
      );
      await expect(
        getGcSubcontractorScorecards("token-123", "2026-09-21", 300),
      ).rejects.toThrow("This is only available to general contractor accounts");
    });

    it("rejects with the generic message when JSON parsing fails", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => {
            throw new Error("bad json");
          },
        }),
      );
      await expect(
        getGcSubcontractorScorecards("token-123", "2026-09-21", 300),
      ).rejects.toThrow(GENERIC);
    });
  });

  describe("getGcSubcontractorScorecard", () => {
    const detail = {
      companyId: "sub-1",
      companyName: "Rivera Electric",
      overallScore: 87,
      jobsites: [
        {
          jobsiteId: "jobsite-1",
          jobsiteName: "Downtown Tower",
          expectedDays: 30,
          loggedDays: 26,
          score: 87,
        },
      ],
    };

    it("GETs /api/gc/subcontractors/:companyId/scorecard with the date and tzOffset query params", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: detail }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        getGcSubcontractorScorecard("token-123", "sub-1", "2026-09-21", 300),
      ).resolves.toEqual(detail);
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/gc/subcontractors/sub-1/scorecard?date=2026-09-21&tzOffset=300",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("rejects with a PlanLimitError on a 403 PLAN_LIMIT (not GC Portfolio)", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          json: async () => ({
            success: false,
            error: "Cross-project subcontractor scorecards are part of GC Portfolio. Upgrade to use them.",
            data: { code: "PLAN_LIMIT" },
          }),
        }),
      );

      const error = await getGcSubcontractorScorecard(
        "token-123",
        "sub-1",
        "2026-09-21",
        300,
      ).catch((e) => e);
      expect(error).toBeInstanceOf(PlanLimitError);
      expect(error.message).toBe(
        "Cross-project subcontractor scorecards are part of GC Portfolio. Upgrade to use them.",
      );
      expect(error.limit).toBeNull();
    });

    it("carries a limit when a PLAN_LIMIT response has one", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          json: async () => ({ success: false, data: { code: "PLAN_LIMIT", limit: 1 } }),
        }),
      );

      const error = await getGcSubcontractorScorecard(
        "token-123",
        "sub-1",
        "2026-09-21",
        300,
      ).catch((e) => e);
      expect(error).toBeInstanceOf(PlanLimitError);
      expect(error.limit).toBe(1);
    });

    it("rejects with the backend error message on a 404 (not a current roster member)", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          json: async () => ({ success: false, error: "Subcontractor not found" }),
        }),
      );
      await expect(
        getGcSubcontractorScorecard("token-123", "sub-9", "2026-09-21", 300),
      ).rejects.toThrow("Subcontractor not found");
    });

    it("rejects with the generic message when the response is unsuccessful without a body", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => null }),
      );
      await expect(
        getGcSubcontractorScorecard("token-123", "sub-1", "2026-09-21", 300),
      ).rejects.toThrow(GENERIC);
    });
  });

  describe("getGcPolicyPush", () => {
    const compliance = {
      talkId: "talk-1",
      talkTitle: "Fall Protection",
      pushedAt: "2026-09-01T00:00:00.000Z",
      pushedByName: "Jane Admin",
      jobsites: [],
      totals: { subs: 0, logged: 0, missing: 0 },
    };

    it("GETs /api/gc/policy-push with the date and tzOffset query params", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: compliance }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(getGcPolicyPush("token-123", "2026-09-21", 300)).resolves.toEqual(
        compliance,
      );
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/gc/policy-push?date=2026-09-21&tzOffset=300",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({ Authorization: "Bearer token-123" }),
        }),
      );
    });

    it("rejects with a PlanLimitError on a 403 PLAN_LIMIT (not GC Portfolio)", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          json: async () => ({
            success: false,
            error: "Top-down corporate policy push is part of GC Portfolio. Upgrade to use it.",
            data: { code: "PLAN_LIMIT" },
          }),
        }),
      );

      const error = await getGcPolicyPush("token-123", "2026-09-21", 300).catch((e) => e);
      expect(error).toBeInstanceOf(PlanLimitError);
      expect(error.message).toBe(
        "Top-down corporate policy push is part of GC Portfolio. Upgrade to use it.",
      );
      expect(error.limit).toBeNull();
    });

    it("carries a limit when a PLAN_LIMIT response has one", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          json: async () => ({ success: false, data: { code: "PLAN_LIMIT", limit: 1 } }),
        }),
      );

      const error = await getGcPolicyPush("token-123", "2026-09-21", 300).catch((e) => e);
      expect(error).toBeInstanceOf(PlanLimitError);
      expect(error.limit).toBe(1);
    });

    it("rejects with the backend error message on a non-PLAN_LIMIT failure", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          json: async () => ({ success: false, error: "You don't have permission to do this" }),
        }),
      );
      await expect(getGcPolicyPush("token-123", "2026-09-21", 300)).rejects.toThrow(
        "You don't have permission to do this",
      );
    });

    it("rejects with the generic message when JSON parsing fails", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => {
            throw new Error("bad json");
          },
        }),
      );
      await expect(getGcPolicyPush("token-123", "2026-09-21", 300)).rejects.toThrow(GENERIC);
    });
  });

  describe("getGcPolicyPushTalks", () => {
    const talks = [{ id: "talk-1", title: "Fall Protection", tradeTag: null }];

    it("GETs /api/gc/policy-push/talks", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: talks }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(getGcPolicyPushTalks("token-123")).resolves.toEqual(talks);
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/gc/policy-push/talks",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({ Authorization: "Bearer token-123" }),
        }),
      );
    });

    it("rejects with a PlanLimitError on a 403 PLAN_LIMIT", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          json: async () => ({ success: false, data: { code: "PLAN_LIMIT" } }),
        }),
      );

      const error = await getGcPolicyPushTalks("token-123").catch((e) => e);
      expect(error).toBeInstanceOf(PlanLimitError);
    });

    it("rejects with the backend error message on a non-PLAN_LIMIT failure", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          json: async () => ({ success: false, error: "Could not load toolbox talks" }),
        }),
      );
      await expect(getGcPolicyPushTalks("token-123")).rejects.toThrow(
        "Could not load toolbox talks",
      );
    });

    it("rejects with the generic message when the response is unsuccessful without a body", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => null }),
      );
      await expect(getGcPolicyPushTalks("token-123")).rejects.toThrow(GENERIC);
    });
  });

  describe("pushGcPolicyTopic", () => {
    const pushed = {
      talkId: "talk-1",
      talkTitle: "Fall Protection",
      pushedAt: "2026-09-21T00:00:00.000Z",
      pushedByName: "Jane Admin",
    };

    it("POSTs /api/gc/policy-push with the talkId body", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: pushed }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(pushGcPolicyTopic("token-123", "talk-1")).resolves.toEqual(pushed);
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/gc/policy-push",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({ Authorization: "Bearer token-123" }),
          body: JSON.stringify({ talkId: "talk-1" }),
        }),
      );
    });

    it("rejects with a PlanLimitError on a 403 PLAN_LIMIT", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          json: async () => ({ success: false, data: { code: "PLAN_LIMIT", limit: 1 } }),
        }),
      );

      const error = await pushGcPolicyTopic("token-123", "talk-1").catch((e) => e);
      expect(error).toBeInstanceOf(PlanLimitError);
      expect(error.limit).toBe(1);
    });

    it("carries the backend error message and no limit on a PLAN_LIMIT response without one", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          json: async () => ({
            success: false,
            error: "Top-down corporate policy push is part of GC Portfolio. Upgrade to use it.",
            data: { code: "PLAN_LIMIT" },
          }),
        }),
      );

      const error = await pushGcPolicyTopic("token-123", "talk-1").catch((e) => e);
      expect(error).toBeInstanceOf(PlanLimitError);
      expect(error.message).toBe(
        "Top-down corporate policy push is part of GC Portfolio. Upgrade to use it.",
      );
      expect(error.limit).toBeNull();
    });

    it("rejects with the backend error message on a 404 (not a global talk)", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          json: async () => ({ success: false, error: "Talk not found" }),
        }),
      );
      await expect(pushGcPolicyTopic("token-123", "talk-1")).rejects.toThrow("Talk not found");
    });

    it("rejects with the generic message when the response is unsuccessful without a body", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => null }),
      );
      await expect(pushGcPolicyTopic("token-123", "talk-1")).rejects.toThrow(GENERIC);
    });
  });

  describe("clearGcPolicyPush", () => {
    it("DELETEs /api/gc/policy-push", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: null }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(clearGcPolicyPush("token-123")).resolves.toBeUndefined();
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/gc/policy-push",
        expect.objectContaining({
          method: "DELETE",
          headers: expect.objectContaining({ Authorization: "Bearer token-123" }),
        }),
      );
    });

    it("rejects with a PlanLimitError on a 403 PLAN_LIMIT", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          json: async () => ({ success: false, data: { code: "PLAN_LIMIT" } }),
        }),
      );

      const error = await clearGcPolicyPush("token-123").catch((e) => e);
      expect(error).toBeInstanceOf(PlanLimitError);
    });

    it("rejects with the backend error message on a non-PLAN_LIMIT failure", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          json: async () => ({ success: false, error: "You don't have permission to do this" }),
        }),
      );
      await expect(clearGcPolicyPush("token-123")).rejects.toThrow(
        "You don't have permission to do this",
      );
    });

    it("rejects with the generic message when the response is unsuccessful without a body", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => null }),
      );
      await expect(clearGcPolicyPush("token-123")).rejects.toThrow(GENERIC);
    });
  });

  describe("getDefenseBundle", () => {
    const zipResponse = (overrides: Partial<Response> = {}) => ({
      ok: true,
      status: 200,
      headers: new Headers({
        "Content-Disposition": 'attachment; filename="riverside-tower-defense-bundle.zip"',
      }),
      blob: async () => new Blob(["zip bytes"], { type: "application/zip" }),
      ...overrides,
    });

    it("GETs /api/gc/jobsites/:id/defense-bundle and resolves the blob with the server's filename", async () => {
      const fetchMock = vi.fn().mockResolvedValue(zipResponse());
      vi.stubGlobal("fetch", fetchMock);

      const result = await getDefenseBundle("token-123", "jobsite-1");

      expect(fetchMock).toHaveBeenCalledWith(
        "/api/gc/jobsites/jobsite-1/defense-bundle",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({ Authorization: "Bearer token-123" }),
        }),
      );
      expect(result.filename).toBe("riverside-tower-defense-bundle.zip");
      expect(result.blob).toBeInstanceOf(Blob);
    });

    it("falls back to a default filename when no Content-Disposition header is present", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(zipResponse({ headers: new Headers() })),
      );

      const result = await getDefenseBundle("token-123", "jobsite-1");

      expect(result.filename).toBe("defense-bundle.zip");
    });

    it("rejects with a PlanLimitError when the jobsite isn't on Site Pro", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          json: async () => ({
            success: false,
            error: "Upgrade this job site to Site Pro to download its OSHA Defense Bundle",
            data: { code: "PLAN_LIMIT" },
          }),
        }),
      );

      const error = await getDefenseBundle("token-123", "jobsite-1").catch((e) => e);
      expect(error).toBeInstanceOf(PlanLimitError);
      expect(error.message).toBe(
        "Upgrade this job site to Site Pro to download its OSHA Defense Bundle",
      );
      expect(error.limit).toBeNull();
    });

    it("falls back to the generic message and carries a limit when a bare PLAN_LIMIT response has one", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          json: async () => ({ success: false, data: { code: "PLAN_LIMIT", limit: 1 } }),
        }),
      );

      const error = await getDefenseBundle("token-123", "jobsite-1").catch((e) => e);
      expect(error).toBeInstanceOf(PlanLimitError);
      expect(error.message).toBe(GENERIC);
      expect(error.limit).toBe(1);
    });

    it("rejects with the backend error message on a 404 (nothing to bundle yet)", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          json: async () => ({
            success: false,
            error: "No completed meeting logs with a generated PDF are available yet for this job site.",
          }),
        }),
      );

      await expect(getDefenseBundle("token-123", "jobsite-1")).rejects.toThrow(
        "No completed meeting logs with a generated PDF are available yet for this job site.",
      );
    });

    it("rejects with the generic message when the error response has no JSON body", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          json: async () => {
            throw new Error("bad json");
          },
        }),
      );

      await expect(getDefenseBundle("token-123", "jobsite-1")).rejects.toThrow(GENERIC);
    });
  });
});
