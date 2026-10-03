import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  addJobsiteSmsRecipient,
  clearMySmsOptIn,
  getMySmsOptIn,
  listJobsiteSmsRecipients,
  removeJobsiteSmsRecipient,
  saveMySmsOptIn,
} from "../../src/services/apiSms";
import { PlanLimitError } from "../../src/utils/PlanLimitError";

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

describe("apiSms", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("getMySmsOptIn GETs /api/sms/me with the bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(null));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getMySmsOptIn("tok")).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/sms/me",
      expect.objectContaining({ method: "GET", headers: { Authorization: "Bearer tok" } }),
    );
  });

  it("saveMySmsOptIn PUTs the phone with consent", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ id: "r1" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(saveMySmsOptIn("tok", "5125550123")).resolves.toEqual({ id: "r1" });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/sms/me");
    expect(options.method).toBe("PUT");
    expect(JSON.parse(options.body)).toEqual({ phone: "5125550123", consent: true });
  });

  it("clearMySmsOptIn DELETEs /api/sms/me", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(null));
    vi.stubGlobal("fetch", fetchMock);

    await expect(clearMySmsOptIn("tok")).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
  });

  it("lists a jobsite's recipients", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse([{ id: "r1" }]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listJobsiteSmsRecipients("tok", "j1")).resolves.toEqual([{ id: "r1" }]);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/sms/jobsites/j1/recipients");
  });

  it("adds a recipient by roster id and phone", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ id: "r1" }));
    vi.stubGlobal("fetch", fetchMock);

    await addJobsiteSmsRecipient("tok", "j1", { rosterId: "m1", phone: "5125550123" });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/sms/jobsites/j1/recipients");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({ rosterId: "m1", phone: "5125550123" });
  });

  it("removes a recipient", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(null));
    vi.stubGlobal("fetch", fetchMock);

    await removeJobsiteSmsRecipient("tok", "j1", "r1");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/sms/jobsites/j1/recipients/r1");
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
  });

  it("rejects with the backend error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(errorResponse(400, { success: false, error: "Bad number" })),
    );
    await expect(getMySmsOptIn("t")).rejects.toThrow("Bad number");
  });

  it("falls back to a generic message for an unreadable or message-less error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(badJsonResponse));
    await expect(getMySmsOptIn("t")).rejects.toThrow(GENERIC);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(errorResponse(500, { success: false })));
    await expect(getMySmsOptIn("t")).rejects.toThrow(GENERIC);
  });

  it("throws a PlanLimitError for a 403 PLAN_LIMIT, with or without a message", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          errorResponse(403, { success: false, error: "Upgrade", data: { code: "PLAN_LIMIT" } }),
        ),
    );
    await expect(addJobsiteSmsRecipient("t", "j1", { rosterId: "m", phone: "p" })).rejects.toThrow(
      PlanLimitError,
    );

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(errorResponse(403, { success: false, data: { code: "PLAN_LIMIT" } })),
    );
    await expect(addJobsiteSmsRecipient("t", "j1", { rosterId: "m", phone: "p" })).rejects.toThrow(
      GENERIC,
    );
  });
});
