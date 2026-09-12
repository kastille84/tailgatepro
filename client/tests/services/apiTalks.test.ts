import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTalk, listTalks } from "../../src/services/apiTalks";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  describe("listTalks", () => {
    it("GETs /api/talks with the bearer token and returns the data array", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [talk] }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(listTalks("token-123")).resolves.toEqual([talk]);
      expect(fetchMock).toHaveBeenCalledWith("/api/talks", {
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

    it("POSTs a client-generated UUID id plus the input, and returns the created talk", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ success: true, data: customTalk }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        createTalk("token-123", {
          title: "Ladder Safety Refresher",
          tradeTag: "Roofing",
          talkingPoints: ["Inspect rungs before use"],
        }),
      ).resolves.toEqual(customTalk);

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/talks");
      expect(options.method).toBe("POST");
      expect(options.headers.Authorization).toBe("Bearer token-123");
      expect(JSON.parse(options.body)).toEqual({
        id: expect.stringMatching(UUID_RE),
        title: "Ladder Safety Refresher",
        tradeTag: "Roofing",
        talkingPoints: ["Inspect rungs before use"],
      });
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
        createTalk("token-123", { title: "", talkingPoints: [] }),
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
        createTalk("token-123", { title: "x", talkingPoints: ["y"] }),
      ).rejects.toThrow(GENERIC);
    });
  });
});
