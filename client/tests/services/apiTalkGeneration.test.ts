import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  generateTalkDraft,
  getAiTalkUsage,
} from "../../src/services/apiTalkGeneration";

const draft = {
  title: "Trench Safety",
  tradeTag: "General",
  summary: "Trenches collapse.",
  talkingPoints: ["Never enter an unprotected trench."],
  siteHazardsToCheck: [],
  discussionQuestions: [],
  oshaStandards: [],
  estimatedMinutes: 5,
};
const usage = { used: 1, limit: 10, remaining: 9 };

describe("generateTalkDraft", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("should POST the topic with the Bearer token and return the draft and usage", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { draft, usage } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      generateTalkDraft("token-123", { topic: "trenching", tradeTag: "Concrete" }),
    ).resolves.toEqual({ draft, usage });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/talks/generate",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token-123",
        },
        body: JSON.stringify({ topic: "trenching", tradeTag: "Concrete" }),
      }),
    );
  });

  it("should reject with the backend error message (e.g. the monthly cap)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({
          success: false,
          error: "You've used all 10 AI drafts for this month",
        }),
      }),
    );

    await expect(
      generateTalkDraft("token-123", { topic: "trenching" }),
    ).rejects.toThrow("You've used all 10 AI drafts for this month");
  });

  it("should fall back to a generic message when the error body is unreadable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => {
          throw new Error("not json");
        },
      }),
    );

    await expect(
      generateTalkDraft("token-123", { topic: "trenching" }),
    ).rejects.toThrow("Could not draft a talk. Please try again.");
  });
});

describe("getAiTalkUsage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("should GET /api/talks/ai-usage with the Bearer token and return the usage", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: usage }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getAiTalkUsage("token-123")).resolves.toEqual(usage);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/talks/ai-usage",
      expect.objectContaining({
        method: "GET",
        headers: { Authorization: "Bearer token-123" },
      }),
    );
  });

  it("should reject with the backend message, or a fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ success: false, error: "Upgrade to Trade Pro" }),
      }),
    );
    await expect(getAiTalkUsage("token-123")).rejects.toThrow("Upgrade to Trade Pro");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => null,
      }),
    );
    await expect(getAiTalkUsage("token-123")).rejects.toThrow(
      "Could not load your AI draft allowance.",
    );
  });
});
