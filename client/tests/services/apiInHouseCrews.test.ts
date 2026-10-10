import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  attachCrewToJobsite,
  createCrewJoinLink,
  createInHouseCrew,
  deleteCrewJoinLink,
  deleteInHouseCrew,
  getCrewJoinLink,
  inviteCrewMember,
  listCrewMembers,
  listInHouseCrews,
  previewCrewJoin,
  removeCrewMember,
  updateInHouseCrew,
} from "../../src/services/apiInHouseCrews";
import { PlanLimitError } from "../../src/utils/PlanLimitError";

const GENERIC = "Something went wrong. Please try again.";

const okResponse = (data: unknown) => ({
  ok: true,
  status: 200,
  json: async () => ({ success: true, data }),
});

const badJsonResponse = {
  ok: true,
  status: 200,
  json: async () => {
    throw new Error("bad json");
  },
};

const errorResponse = (error: string, data?: unknown) => ({
  ok: false,
  status: 409,
  json: async () => ({ success: false, error, data }),
});

describe("apiInHouseCrews", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("lists crews with a bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse([{ id: "c1" }]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listInHouseCrews("token-123")).resolves.toEqual([{ id: "c1" }]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/companies/in-house",
      expect.objectContaining({ method: "GET", headers: { Authorization: "Bearer token-123" } }),
    );
  });

  it("creates a crew with a JSON body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ id: "c1" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createInHouseCrew("token-123", { name: "Hyperion - Framing" })).resolves.toEqual({
      id: "c1",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/companies/in-house",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer token-123" },
        body: JSON.stringify({ name: "Hyperion - Framing" }),
      }),
    );
  });

  it("patches a crew by id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ id: "c1" }));
    vi.stubGlobal("fetch", fetchMock);

    await updateInHouseCrew("token-123", "c1", { archived: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/companies/in-house/c1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ archived: true }) }),
    );
  });

  it("deletes a crew by id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ id: "c1" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(deleteInHouseCrew("token-123", "c1")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/companies/in-house/c1",
      expect.objectContaining({ method: "DELETE", headers: { Authorization: "Bearer token-123" } }),
    );
  });

  it("invites a crew member without sending the crew id in the body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okResponse({ email: "f@example.com", role: "foreman" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      inviteCrewMember("token-123", { crewId: "c1", email: "f@example.com", role: "foreman" }),
    ).resolves.toEqual({ email: "f@example.com", role: "foreman" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/companies/in-house/c1/invite",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "f@example.com", role: "foreman" }),
      }),
    );
  });

  it("attaches a crew to a job site", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ alreadyAttached: false }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(attachCrewToJobsite("token-123", "j1", "c1")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/jobsites/j1/in-house/c1",
      expect.objectContaining({ method: "POST", headers: { Authorization: "Bearer token-123" } }),
    );
  });

  it("rejects with the backend error message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(errorResponse("Archive it instead")));
    await expect(deleteInHouseCrew("token-123", "c1")).rejects.toThrow("Archive it instead");
  });

  it("falls back to a generic message when the body is not JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(badJsonResponse));
    await expect(listInHouseCrews("token-123")).rejects.toThrow(GENERIC);
  });

  it("falls back to a generic message when the error has no text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({ success: false }) }),
    );
    await expect(listInHouseCrews("token-123")).rejects.toThrow(GENERIC);
  });

  it("throws a PlanLimitError for a PLAN_LIMIT rejection", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(errorResponse("Seat limit", { code: "PLAN_LIMIT", limit: 1 })),
    );
    const error = await inviteCrewMember("token-123", {
      crewId: "c1",
      email: "f@example.com",
      role: "foreman",
    }).catch((e) => e);

    expect(error).toBeInstanceOf(PlanLimitError);
    expect((error as PlanLimitError).limit).toBe(1);
  });

  it("throws a PlanLimitError with a null limit and the generic message when absent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ success: false, data: { code: "PLAN_LIMIT" } }),
      }),
    );
    const error = await createInHouseCrew("token-123", { name: "x" }).catch((e) => e);

    expect(error).toBeInstanceOf(PlanLimitError);
    expect((error as PlanLimitError).message).toBe(GENERIC);
    expect((error as PlanLimitError).limit).toBeNull();
  });

  describe("join link and members (Phase 13f-join)", () => {
    it("gets a crew join link, which may be null", async () => {
      const fetchMock = vi.fn().mockResolvedValue(okResponse(null));
      vi.stubGlobal("fetch", fetchMock);

      await expect(getCrewJoinLink("token-123", "c1")).resolves.toBeNull();
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/companies/in-house/c1/join-link",
        expect.objectContaining({ method: "GET", headers: { Authorization: "Bearer token-123" } }),
      );
    });

    it("creates a crew join link", async () => {
      const link = { joinUrl: "https://x/crew-join/t", expiresAt: "2026-02-01", usesLeft: 10 };
      const fetchMock = vi.fn().mockResolvedValue(okResponse(link));
      vi.stubGlobal("fetch", fetchMock);

      await expect(createCrewJoinLink("token-123", "c1")).resolves.toEqual(link);
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/companies/in-house/c1/join-link",
        expect.objectContaining({ method: "POST", headers: { Authorization: "Bearer token-123" } }),
      );
    });

    it("turns a crew join link off", async () => {
      const fetchMock = vi.fn().mockResolvedValue(okResponse(null));
      vi.stubGlobal("fetch", fetchMock);

      await expect(deleteCrewJoinLink("token-123", "c1")).resolves.toBeUndefined();
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/companies/in-house/c1/join-link",
        expect.objectContaining({ method: "DELETE" }),
      );
    });

    it("lists a crew's members", async () => {
      const fetchMock = vi.fn().mockResolvedValue(okResponse([{ id: "u1" }]));
      vi.stubGlobal("fetch", fetchMock);

      await expect(listCrewMembers("token-123", "c1")).resolves.toEqual([{ id: "u1" }]);
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/companies/in-house/c1/members",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("removes a crew member", async () => {
      const fetchMock = vi.fn().mockResolvedValue(okResponse(null));
      vi.stubGlobal("fetch", fetchMock);

      await expect(removeCrewMember("token-123", "c1", "u1")).resolves.toBeUndefined();
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/companies/in-house/c1/members/u1",
        expect.objectContaining({ method: "DELETE" }),
      );
    });

    it("previews a join link without a session", async () => {
      const fetchMock = vi.fn().mockResolvedValue(okResponse({ crewName: "C", gcName: "G" }));
      vi.stubGlobal("fetch", fetchMock);

      await expect(previewCrewJoin("tok")).resolves.toEqual({ crewName: "C", gcName: "G" });
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/companies/crew-join/tok",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("rejects a bad join link with the server message", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(errorResponse("This join link is invalid or has expired")),
      );

      await expect(previewCrewJoin("tok")).rejects.toThrow(
        "This join link is invalid or has expired",
      );
    });
  });
});
