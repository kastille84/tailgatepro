import { beforeEach, describe, expect, it, vi } from "vitest";

import { addFavorite, listFavorites, removeFavorite } from "../../src/services/apiFavorites";

const favorite = {
  talkId: "talk-1",
  createdAt: "2026-09-09T00:00:00.000Z",
};

const GENERIC = "Something went wrong. Please try again.";

describe("apiFavorites", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("listFavorites", () => {
    it("GETs /api/favorites with the bearer token and returns the data array", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [favorite] }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(listFavorites("token-123")).resolves.toEqual([favorite]);
      expect(fetchMock).toHaveBeenCalledWith("/api/favorites", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token-123",
        },
      });
    });

    it("rejects with the backend error message on an error response", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 502,
          json: async () => ({ success: false, error: "Could not load favorites" }),
        }),
      );
      await expect(listFavorites("token-123")).rejects.toThrow(
        "Could not load favorites",
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
      await expect(listFavorites("token-123")).rejects.toThrow(GENERIC);
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
      await expect(listFavorites("token-123")).rejects.toThrow(GENERIC);
    });
  });

  describe("addFavorite", () => {
    it("POSTs /api/favorites with the talk id and returns the created row", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ success: true, data: favorite }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(addFavorite("token-123", "talk-1")).resolves.toEqual(favorite);
      expect(fetchMock).toHaveBeenCalledWith("/api/favorites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token-123",
        },
        body: JSON.stringify({ talkId: "talk-1" }),
      });
    });

    it("rejects with the backend error message on an error response", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          json: async () => ({ success: false, error: "Talk not found" }),
        }),
      );
      await expect(addFavorite("token-123", "missing")).rejects.toThrow(
        "Talk not found",
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
      await expect(addFavorite("token-123", "talk-1")).rejects.toThrow(GENERIC);
    });

    it("rejects with the generic message when JSON parsing fails", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 201,
          json: async () => {
            throw new Error("bad json");
          },
        }),
      );
      await expect(addFavorite("token-123", "talk-1")).rejects.toThrow(GENERIC);
    });
  });

  describe("removeFavorite", () => {
    it("DELETEs /api/favorites/:talkId with the bearer token and returns the talk id", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { talkId: "talk-1" } }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(removeFavorite("token-123", "talk-1")).resolves.toEqual({
        talkId: "talk-1",
      });
      expect(fetchMock).toHaveBeenCalledWith("/api/favorites/talk-1", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token-123",
        },
      });
    });

    it("rejects with the backend error message on an error response", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 502,
          json: async () => ({ success: false, error: "Could not remove the favorite" }),
        }),
      );
      await expect(removeFavorite("token-123", "talk-1")).rejects.toThrow(
        "Could not remove the favorite",
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
      await expect(removeFavorite("token-123", "talk-1")).rejects.toThrow(GENERIC);
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
      await expect(removeFavorite("token-123", "talk-1")).rejects.toThrow(GENERIC);
    });
  });
});
