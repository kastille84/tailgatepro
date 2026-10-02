import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  connectProjectIntegration,
  disconnectProjectIntegration,
  listProjectIntegrations,
  retryProjectIntegrationPush,
} from "../../src/services/apiIntegrations";

const okResponse = (data: unknown) => ({
  ok: true,
  status: 200,
  json: async () => ({ success: true, data }),
});

describe("apiIntegrations (project / Trade Enterprise)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("listProjectIntegrations GETs the project's integrations", async () => {
    const result = { enterprise: true, integrations: [], recentPushes: [] };
    const fetchMock = vi.fn().mockResolvedValue(okResponse(result));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listProjectIntegrations("tok", "pr1")).resolves.toEqual(result);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects/pr1/integrations",
      expect.objectContaining({ method: "GET", headers: { Authorization: "Bearer tok" } }),
    );
  });

  it("connectProjectIntegration PUTs credentials and the provider-side project id", async () => {
    const integration = { id: "i1", provider: "jobtread" };
    const fetchMock = vi.fn().mockResolvedValue(okResponse(integration));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      connectProjectIntegration("tok", {
        tailgateProjectId: "pr1",
        provider: "jobtread",
        credentials: { grantKey: "gk" },
        projectId: "job-1",
      }),
    ).resolves.toEqual(integration);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/projects/pr1/integrations/jobtread");
    expect(options.method).toBe("PUT");
    expect(JSON.parse(options.body)).toEqual({
      credentials: { grantKey: "gk" },
      projectId: "job-1",
    });
  });

  it("disconnectProjectIntegration DELETEs the provider", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(null));
    vi.stubGlobal("fetch", fetchMock);

    await expect(disconnectProjectIntegration("tok", "pr1", "procore")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects/pr1/integrations/procore",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("retryProjectIntegrationPush POSTs to the project retry endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ status: "failed" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(retryProjectIntegrationPush("tok", "p1")).resolves.toEqual({ status: "failed" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/project-integrations/pushes/p1/retry",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
