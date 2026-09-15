import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createMeetingLog,
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
});
