import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTalk, deleteTalk, listTalks, updateTalk } from "../../src/services/apiTalks";
import { DEFAULT_FETCH_TIMEOUT_MS } from "../../src/utils/fetchWithTimeout";

const talk = {
  id: "talk-1",
  slug: "eye-protection",
  title: "Eye Protection on the Jobsite",
  tradeTag: "General Construction",
  tradeTags: ["General Construction", "Welding"],
  content: "# Eye Protection on the Jobsite\n",
  structured: { summary: "...", talking_points: [] },
  attribution: { source: "NIOSH" },
  isGlobal: true,
  companyId: null,
  createdAt: "2026-09-09T00:00:00.000Z",
};

const GENERIC = "Something went wrong. Please try again.";

describe("apiTalks", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("listTalks", () => {
    it("GETs /api/talks with the bearer token and returns the data array", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [talk] }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(listTalks("token-123")).resolves.toEqual([talk]);
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/talks",
        expect.objectContaining({
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer token-123",
          },
          signal: expect.any(AbortSignal),
        }),
      );
    });

    it("rejects (rather than hanging forever) when the request never gets a response", async () => {
      // The bug this guards against: a request that's accepted but never
      // answered (e.g. Chrome DevTools' Network "Offline" throttle, which
      // doesn't flip navigator.onLine) must not hang the caller forever.
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

      const promise = listTalks("token-123");
      const assertion = expect(promise).rejects.toMatchObject({
        name: "AbortError",
      });

      await vi.advanceTimersByTimeAsync(DEFAULT_FETCH_TIMEOUT_MS);
      await assertion;

      vi.useRealTimers();
    });

    it("rejects with the backend error message on an error response", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 502,
          json: async () => ({
            success: false,
            error: "Could not load toolbox talks",
          }),
        }),
      );
      await expect(listTalks("token-123")).rejects.toThrow(
        "Could not load toolbox talks",
      );
    });

    it("rejects with the generic message when the body has no error field", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          json: async () => ({ success: false }),
        }),
      );
      await expect(listTalks("token-123")).rejects.toThrow(GENERIC);
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
      await expect(listTalks("token-123")).rejects.toThrow(GENERIC);
    });
  });

  describe("createTalk", () => {
    const customTalk = { ...talk, id: "talk-2", isGlobal: false, companyId: "company-1" };

    it("POSTs the exact input, including the caller-supplied id, and returns the created talk", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ success: true, data: customTalk }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const input = {
        id: "talk-2",
        title: "Ladder Safety Refresher",
        tradeTag: "Roofing",
        talkingPoints: ["Inspect rungs before use"],
      };

      await expect(createTalk("token-123", input)).resolves.toEqual(
        customTalk,
      );

      expect(fetchMock).toHaveBeenCalledWith(
        "/api/talks",
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
          json: async () => ({ success: false, error: "Title is required" }),
        }),
      );
      await expect(
        createTalk("token-123", { id: "talk-2", title: "", talkingPoints: [] }),
      ).rejects.toThrow("Title is required");
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
        createTalk("token-123", {
          id: "talk-2",
          title: "x",
          talkingPoints: ["y"],
        }),
      ).rejects.toThrow(GENERIC);
    });
  });

  describe("updateTalk", () => {
    const updatedTalk = {
      ...talk,
      id: "talk-2",
      title: "Ladder Safety Refresher (Updated)",
      isGlobal: false,
      companyId: "company-1",
    };

    it("PATCHes /api/talks/:id with the input body and returns the updated talk", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: updatedTalk }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const input = {
        title: "Ladder Safety Refresher (Updated)",
        talkingPoints: ["Inspect rungs before use"],
      };

      await expect(
        updateTalk("token-123", "talk-2", input),
      ).resolves.toEqual(updatedTalk);

      expect(fetchMock).toHaveBeenCalledWith(
        "/api/talks/talk-2",
        expect.objectContaining({
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer token-123",
          },
          body: JSON.stringify(input),
          signal: expect.any(AbortSignal),
        }),
      );
    });

    it("rejects with the backend message on the 409 in-use guard", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 409,
          json: async () => ({
            success: false,
            error:
              "This talk has been used in a logged safety talk and can't be edited or deleted.",
          }),
        }),
      );
      await expect(
        updateTalk("token-123", "talk-2", { title: "x", talkingPoints: ["y"] }),
      ).rejects.toThrow("can't be edited or deleted.");
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
        updateTalk("token-123", "talk-2", { title: "x", talkingPoints: ["y"] }),
      ).rejects.toThrow(GENERIC);
    });
  });

  describe("deleteTalk", () => {
    it("DELETEs /api/talks/:id with the bearer token and returns the id", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { id: "talk-2" } }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(deleteTalk("token-123", "talk-2")).resolves.toEqual({
        id: "talk-2",
      });
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/talks/talk-2",
        expect.objectContaining({
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer token-123",
          },
          signal: expect.any(AbortSignal),
        }),
      );
    });

    it("rejects with the backend message on the 409 in-use guard", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 409,
          json: async () => ({
            success: false,
            error:
              "This talk has been used in a logged safety talk and can't be edited or deleted.",
          }),
        }),
      );
      await expect(deleteTalk("token-123", "talk-2")).rejects.toThrow(
        "can't be edited or deleted.",
      );
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
      await expect(deleteTalk("token-123", "talk-2")).rejects.toThrow(GENERIC);
    });
  });
});
