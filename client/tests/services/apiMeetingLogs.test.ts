import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  completeMeeting,
  createMeetingLog,
  getMeetingLogs,
  getMeetingMonths,
  getMeetingPdfUrl,
  uploadCrewPhoto,
} from "../../src/services/apiMeetingLogs";
import { DEFAULT_FETCH_TIMEOUT_MS } from "../../src/utils/fetchWithTimeout";

const meetingLog = {
  id: "meeting-1",
  projectId: "project-1",
  talkId: "talk-1",
  foremanId: "user-1",
  companyId: "company-1",
  crewPhotoUrl: null,
  finalPdfUrl: null,
  completedAt: null,
  heldAt: null,
  syncedAt: null,
  createdAt: "2026-09-15T00:00:00.000Z",
};

const GENERIC = "Something went wrong. Please try again.";

describe("apiMeetingLogs", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("createMeetingLog", () => {
    it("POSTs the exact input, including the caller-supplied id, and returns the created meeting log", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ success: true, data: meetingLog }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const input = { id: "meeting-1", projectId: "project-1", talkId: "talk-1" };

      await expect(createMeetingLog("token-123", input)).resolves.toEqual(
        meetingLog,
      );
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/meetings",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer token-123",
          },
          body: JSON.stringify(input),
          signal: expect.any(AbortSignal),
        }),
      );
    });

    it("rejects with the backend error message on an error response", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          json: async () => ({
            success: false,
            error: "That project doesn't exist",
          }),
        }),
      );
      await expect(
        createMeetingLog("token-123", { id: "meeting-1", projectId: "project-1" }),
      ).rejects.toThrow("That project doesn't exist");
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
        createMeetingLog("token-123", { id: "meeting-1", projectId: "project-1" }),
      ).rejects.toThrow(GENERIC);
    });

    it("rejects (rather than hanging forever) when the request never gets a response", async () => {
      vi.useFakeTimers();
      vi.stubGlobal(
        "fetch",
        vi.fn((_url: string, init?: RequestInit) => {
          return new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(
                new DOMException("The operation was aborted.", "AbortError"),
              );
            });
          });
        }),
      );

      const promise = createMeetingLog("token-123", {
        id: "meeting-1",
        projectId: "project-1",
      });
      const assertion = expect(promise).rejects.toMatchObject({
        name: "AbortError",
      });

      await vi.advanceTimersByTimeAsync(DEFAULT_FETCH_TIMEOUT_MS);
      await assertion;

      vi.useRealTimers();
    });
  });

  describe("uploadCrewPhoto", () => {
    it("PUTs the raw blob body with its mime type and the bearer token", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { ...meetingLog, crewPhotoUrl: "meeting-1/photo.jpg" },
        }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const blob = new Blob(["jpg-bytes"], { type: "image/jpeg" });

      await expect(
        uploadCrewPhoto("token-123", "meeting-1", blob),
      ).resolves.toMatchObject({ crewPhotoUrl: "meeting-1/photo.jpg" });

      expect(fetchMock).toHaveBeenCalledWith(
        "/api/meetings/meeting-1/crew-photo",
        expect.objectContaining({
          method: "PUT",
          headers: {
            Authorization: "Bearer token-123",
            "Content-Type": "image/jpeg",
          },
          body: blob,
          signal: expect.any(AbortSignal),
        }),
      );
    });

    it("falls back to image/jpeg when the blob has no type set", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: meetingLog }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await uploadCrewPhoto("token-123", "meeting-1", new Blob(["x"]));

      expect(fetchMock).toHaveBeenCalledWith(
        "/api/meetings/meeting-1/crew-photo",
        expect.objectContaining({
          headers: {
            Authorization: "Bearer token-123",
            "Content-Type": "image/jpeg",
          },
        }),
      );
    });

    it("rejects with the backend error message once the meeting is completed", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 409,
          json: async () => ({
            success: false,
            error:
              "This meeting has already been completed and can't be changed.",
          }),
        }),
      );
      await expect(
        uploadCrewPhoto("token-123", "meeting-1", new Blob(["x"])),
      ).rejects.toThrow("can't be changed.");
    });

    it("rejects with the generic message when the response body has no error field", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          json: async () => ({ success: false }),
        }),
      );
      await expect(
        uploadCrewPhoto("token-123", "meeting-1", new Blob(["x"])),
      ).rejects.toThrow(GENERIC);
    });
  });

  describe("completeMeeting", () => {
    it("PATCHes a JSON body carrying heldAt (when the meeting was held) alongside the bearer token", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            ...meetingLog,
            completedAt: "2026-09-21T06:00:00.000Z",
            heldAt: "2026-09-20T22:30:00.000Z",
          },
        }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        completeMeeting("token-123", "meeting-1", "2026-09-20T22:30:00.000Z"),
      ).resolves.toMatchObject({ heldAt: "2026-09-20T22:30:00.000Z" });

      expect(fetchMock).toHaveBeenCalledWith(
        "/api/meetings/meeting-1/complete",
        expect.objectContaining({
          method: "PATCH",
          headers: {
            Authorization: "Bearer token-123",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ heldAt: "2026-09-20T22:30:00.000Z" }),
        }),
      );
    });

    it("PATCHes with only the bearer token (no body) and returns the completed meeting log", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { ...meetingLog, completedAt: "2026-09-17T00:00:00.000Z" },
        }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        completeMeeting("token-123", "meeting-1"),
      ).resolves.toMatchObject({ completedAt: "2026-09-17T00:00:00.000Z" });

      expect(fetchMock).toHaveBeenCalledWith(
        "/api/meetings/meeting-1/complete",
        expect.objectContaining({
          method: "PATCH",
          headers: { Authorization: "Bearer token-123" },
          signal: expect.any(AbortSignal),
        }),
      );
      expect(fetchMock.mock.calls[0][1]).not.toHaveProperty("body");
    });

    it("rejects with the backend error message on an error response", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 409,
          json: async () => ({
            success: false,
            error: "A meeting needs at least one signature before it can be completed.",
          }),
        }),
      );
      await expect(
        completeMeeting("token-123", "meeting-1"),
      ).rejects.toThrow("at least one signature");
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
        completeMeeting("token-123", "meeting-1"),
      ).rejects.toThrow(GENERIC);
    });
  });

  describe("getMeetingLogs", () => {
    it("GETs the list and returns the meetings", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [meetingLog] }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(getMeetingLogs("token-123")).resolves.toEqual([meetingLog]);
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/meetings",
        expect.objectContaining({
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer token-123",
          },
        }),
      );
    });

    it("sends the projectId and from/to month range as query params", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [meetingLog] }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await getMeetingLogs("token-123", {
        projectId: "project-1",
        from: "2026-09-01T00:00:00.000Z",
        to: "2026-10-01T00:00:00.000Z",
      });

      const url = new URL(fetchMock.mock.calls[0][0], "http://localhost");
      expect(url.pathname).toBe("/api/meetings");
      expect(url.searchParams.get("projectId")).toBe("project-1");
      expect(url.searchParams.get("from")).toBe("2026-09-01T00:00:00.000Z");
      expect(url.searchParams.get("to")).toBe("2026-10-01T00:00:00.000Z");
    });

    it("rejects with the backend error message on an error response", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 502,
          json: async () => ({ success: false, error: "Could not load meetings" }),
        }),
      );
      await expect(getMeetingLogs("token-123")).rejects.toThrow(
        "Could not load meetings",
      );
    });

    it("rejects with the generic message when the response has no body", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          json: async () => {
            throw new Error("not json");
          },
        }),
      );
      await expect(getMeetingLogs("token-123")).rejects.toThrow(GENERIC);
    });
  });

  describe("getMeetingMonths", () => {
    it("GETs the months with the tzOffset and returns them with the history meta", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: [{ month: "2026-09", count: 3 }],
          meta: { hiddenCount: 3, historyDays: 30 },
        }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(getMeetingMonths("token-123", 300)).resolves.toEqual({
        months: [{ month: "2026-09", count: 3 }],
        hiddenCount: 3,
        historyDays: 30,
      });
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/meetings/months?tzOffset=300",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("defaults a missing meta to no hidden rows and no window", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: [] }),
        }),
      );

      await expect(getMeetingMonths("token-123", 0)).resolves.toEqual({
        months: [],
        hiddenCount: 0,
        historyDays: null,
      });
    });

    it("rejects with the backend error message on an error response", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
          json: async () => ({
            success: false,
            error: "tzOffset must be minutes between -840 and 840",
          }),
        }),
      );
      await expect(getMeetingMonths("token-123", 9999)).rejects.toThrow(
        "tzOffset must be minutes",
      );
    });

    it("rejects with the generic message when the response has no body", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          json: async () => null,
        }),
      );
      await expect(getMeetingMonths("token-123", 0)).rejects.toThrow(GENERIC);
    });
  });

  describe("getMeetingPdfUrl", () => {
    it("GETs the pdf-url endpoint and returns the signed url", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { url: "https://signed.example/report.pdf" },
        }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(getMeetingPdfUrl("token-123", "meeting-1")).resolves.toBe(
        "https://signed.example/report.pdf",
      );
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/meetings/meeting-1/pdf-url",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("rejects with the plan-limit message for a meeting outside the window", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          json: async () => ({
            success: false,
            error: "This meeting is older than your plan's history. Upgrade to view it.",
          }),
        }),
      );
      await expect(getMeetingPdfUrl("token-123", "meeting-1")).rejects.toThrow(
        "older than your plan's history",
      );
    });

    it("rejects with the generic message when the response has no body", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          json: async () => null,
        }),
      );
      await expect(getMeetingPdfUrl("token-123", "meeting-1")).rejects.toThrow(
        GENERIC,
      );
    });
  });
});
