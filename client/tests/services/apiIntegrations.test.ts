import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  connectIntegration,
  disconnectIntegration,
  listJobsiteIntegrations,
  retryIntegrationPush,
} from "../../src/services/apiIntegrations";

const GENERIC = "Something went wrong. Please try again.";

const okResponse = (data: unknown) => ({
  ok: true,
  status: 200,
  json: async () => ({ success: true, data }),
});

const errorResponse = (status: number, body: unknown) => ({
  ok: false,
  status,
  json: async () => body,
});

const badJsonResponse = {
  ok: false,
  status: 502,
  json: async () => {
    throw new Error("bad json");
  },
};

describe("apiIntegrations", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("listJobsiteIntegrations GETs the jobsite's integrations", async () => {
    const result = { sitePro: true, integrations: [], recentPushes: [] };
    const fetchMock = vi.fn().mockResolvedValue(okResponse(result));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listJobsiteIntegrations("tok", "j1")).resolves.toEqual(result);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/jobsites/j1/integrations",
      expect.objectContaining({
        method: "GET",
        headers: { Authorization: "Bearer tok" },
      }),
    );
  });

  it("connectIntegration PUTs credentials, project and folder", async () => {
    const integration = { id: "i1", provider: "procore" };
    const fetchMock = vi.fn().mockResolvedValue(okResponse(integration));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      connectIntegration("tok", {
        jobsiteId: "j1",
        provider: "procore",
        credentials: { clientId: "a" },
        projectId: "77",
        folderId: "5",
      }),
    ).resolves.toEqual(integration);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/jobsites/j1/integrations/procore");
    expect(options.method).toBe("PUT");
    expect(JSON.parse(options.body)).toEqual({
      credentials: { clientId: "a" },
      projectId: "77",
      folderId: "5",
    });
  });

  it("disconnectIntegration DELETEs the provider", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(null));
    vi.stubGlobal("fetch", fetchMock);

    await expect(disconnectIntegration("tok", "j1", "acc")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/jobsites/j1/integrations/acc",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("retryIntegrationPush POSTs to the retry endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ status: "sent" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(retryIntegrationPush("tok", "p1")).resolves.toEqual({ status: "sent" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/integrations/pushes/p1/retry",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("rejects with the backend error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(errorResponse(502, { success: false, error: "Procore rejected the request (401)" })),
    );
    await expect(listJobsiteIntegrations("tok", "j1")).rejects.toThrow(
      "Procore rejected the request (401)",
    );
  });

  it("falls back to a generic message on an unreadable or error-less body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(badJsonResponse));
    await expect(listJobsiteIntegrations("tok", "j1")).rejects.toThrow(GENERIC);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(errorResponse(500, { success: false })));
    await expect(retryIntegrationPush("tok", "p1")).rejects.toThrow(GENERIC);
  });
});
