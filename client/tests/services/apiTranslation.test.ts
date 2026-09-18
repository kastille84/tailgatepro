import { beforeEach, describe, expect, it, vi } from "vitest";

import { getTranslationLanguages } from "../../src/services/apiTranslation";

describe("getTranslationLanguages", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("should GET /api/talks/translation-languages with the access token as a Bearer header and return the data", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: [{ code: "es", name: "Spanish" }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getTranslationLanguages("token-123")).resolves.toEqual([
      { code: "es", name: "Spanish" },
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/talks/translation-languages",
      expect.objectContaining({
        method: "GET",
        headers: { Authorization: "Bearer token-123" },
      }),
    );
  });

  it("should reject with the backend error message on an error response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({
          success: false,
          error: "Upgrade to Trade Pro to unlock multi-language talks",
        }),
      }),
    );

    await expect(getTranslationLanguages("token-123")).rejects.toThrow(
      "Upgrade to Trade Pro to unlock multi-language talks",
    );
  });

  it("should reject with the generic error when the response body is malformed JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      }),
    );

    await expect(getTranslationLanguages("token-123")).rejects.toThrow(
      "Could not load translation languages.",
    );
  });
});
