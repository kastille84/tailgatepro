import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getGcOverview,
  getGcMeetings,
  getGcMeetingById,
  getGcMeetingPdfUrl,
} from "../../src/services/apiGc";

const GENERIC = "Something went wrong. Please try again.";

const overview = {
  jobsites: [{ name: "Downtown Tower", subs: [] }],
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
    it("GETs /api/gc/meetings with no query string when no filters are given", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [meeting] }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(getGcMeetings("token-123")).resolves.toEqual([meeting]);
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/gc/meetings",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("builds a query string from only the provided filters", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [meeting] }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await getGcMeetings("token-123", { projectId: "project-1" });

      expect(fetchMock).toHaveBeenCalledWith(
        "/api/gc/meetings?projectId=project-1",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("includes every provided filter in the query string", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [] }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await getGcMeetings("token-123", {
        projectId: "project-1",
        from: "2026-09-01T00:00:00.000Z",
        to: "2026-09-21T00:00:00.000Z",
      });

      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain("projectId=project-1");
      expect(url).toContain("from=2026-09-01T00%3A00%3A00.000Z");
      expect(url).toContain("to=2026-09-21T00%3A00%3A00.000Z");
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
});
