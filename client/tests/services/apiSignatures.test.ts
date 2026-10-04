import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createSignature,
  uploadSignatureBlob,
} from "../../src/services/apiSignatures";
import { DEFAULT_FETCH_TIMEOUT_MS } from "../../src/utils/fetchWithTimeout";

const signature = {
  id: "signature-1",
  meetingId: "meeting-1",
  workerName: "Jordan Smith",
  signaturePath: "meeting-1/signature-1.png",
  quizPassed: true,
  quizScore: 3,
  quizAnswers: [{ questionIndex: 0, selectedIndex: 1, correct: true }],
  createdAt: "2026-09-15T00:00:00.000Z",
};

const GENERIC = "Something went wrong. Please try again.";

describe("apiSignatures", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("createSignature", () => {
    it("POSTs the exact input, including the caller-supplied id, and returns the created signature", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ success: true, data: signature }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const input = {
        id: "signature-1",
        workerName: "Jordan Smith",
        quizAnswers: [{ questionIndex: 0, selectedIndex: 1 }],
      };

      await expect(
        createSignature("token-123", "meeting-1", input),
      ).resolves.toEqual(signature);
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/meetings/meeting-1/signatures",
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

    it("rejects with the backend error message on a validation failure", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
          json: async () => ({
            success: false,
            error: "Worker name is required",
          }),
        }),
      );
      await expect(
        createSignature("token-123", "meeting-1", {
          id: "signature-1",
          workerName: "",
        }),
      ).rejects.toThrow("Worker name is required");
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
        createSignature("token-123", "meeting-1", {
          id: "signature-1",
          workerName: "Jordan Smith",
        }),
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

      const promise = createSignature("token-123", "meeting-1", {
        id: "signature-1",
        workerName: "Jordan Smith",
      });
      const assertion = expect(promise).rejects.toMatchObject({
        name: "AbortError",
      });

      await vi.advanceTimersByTimeAsync(DEFAULT_FETCH_TIMEOUT_MS);
      await assertion;

      vi.useRealTimers();
    });
  });

  describe("uploadSignatureBlob", () => {
    it("PUTs the raw blob body with a hardcoded image/png content type and the bearer token", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: signature }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const blob = new Blob(["png-bytes"], { type: "image/png" });

      await expect(
        uploadSignatureBlob("token-123", "meeting-1", "signature-1", blob),
      ).resolves.toEqual(signature);

      expect(fetchMock).toHaveBeenCalledWith(
        "/api/meetings/meeting-1/signatures/signature-1/blob",
        expect.objectContaining({
          method: "PUT",
          headers: {
            Authorization: "Bearer token-123",
            "Content-Type": "image/png",
          },
          body: blob,
          signal: expect.any(AbortSignal),
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
        uploadSignatureBlob(
          "token-123",
          "meeting-1",
          "signature-1",
          new Blob(["x"], { type: "image/png" }),
        ),
      ).rejects.toThrow("can't be changed.");
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
        uploadSignatureBlob(
          "token-123",
          "meeting-1",
          "signature-1",
          new Blob(["x"], { type: "image/png" }),
        ),
      ).rejects.toThrow(GENERIC);
    });
  });
});
