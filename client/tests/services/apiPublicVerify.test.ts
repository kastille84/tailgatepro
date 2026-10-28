import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  checkPublicPdfHash,
  getPublicSealStatus,
} from "../../src/services/apiPublicVerify";

const GENERIC = "Something went wrong. Please try again.";

describe("apiPublicVerify", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("getPublicSealStatus", () => {
    it("GETs the public verify endpoint with no auth header and returns the data", async () => {
      const data = {
        sealed: true,
        valid: true,
        sealedAt: "2026-09-21T13:05:00.000Z",
        fileFingerprint: true,
        imageMismatchCount: 0,
      };
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(getPublicSealStatus("meeting-1")).resolves.toEqual(data);
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/public/meetings/meeting-1/verify",
        expect.objectContaining({ method: "GET" }),
      );
      expect(fetchMock.mock.calls[0][1].headers).toBeUndefined();
    });

    it("throws the server's error message on a non-ok response", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          json: async () => ({ success: false, error: "Meeting not found" }),
        }),
      );

      await expect(getPublicSealStatus("meeting-1")).rejects.toThrow("Meeting not found");
    });

    it("falls back to a generic message when the body isn't JSON", async () => {
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

      await expect(getPublicSealStatus("meeting-1")).rejects.toThrow(GENERIC);
    });
  });

  describe("checkPublicPdfHash", () => {
    it("POSTs only the digest as JSON and returns the verdict", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { matches: true, status: "current" },
        }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(checkPublicPdfHash("meeting-1", "a".repeat(64))).resolves.toEqual({
        matches: true,
        status: "current",
      });
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/public/meetings/meeting-1/verify-file",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sha256: "a".repeat(64) }),
        }),
      );
    });

    it("throws the server's error message on a non-ok response", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          json: async () => ({
            success: false,
            error: "No file fingerprint is on record for this report",
          }),
        }),
      );

      await expect(checkPublicPdfHash("meeting-1", "a".repeat(64))).rejects.toThrow(
        "No file fingerprint is on record for this report",
      );
    });

    it("falls back to a generic message when the body isn't JSON", async () => {
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

      await expect(checkPublicPdfHash("meeting-1", "a".repeat(64))).rejects.toThrow(GENERIC);
    });
  });
});
