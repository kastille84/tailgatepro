import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  acceptJobsiteInvite,
  createJobsite,
  getJobsiteInvitePreview,
  inviteSubcontractor,
  listJobsites,
  removeSubcontractor,
  updateJobsite,
} from "../../src/services/apiJobsites";

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

describe("apiJobsites", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("listJobsites", () => {
    it("GETs /api/jobsites with the bearer token and returns the jobsites", async () => {
      const fetchMock = vi.fn().mockResolvedValue(okResponse([{ id: "j1" }]));
      vi.stubGlobal("fetch", fetchMock);

      await expect(listJobsites("token-123")).resolves.toEqual([{ id: "j1" }]);
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/jobsites",
        expect.objectContaining({
          method: "GET",
          headers: { Authorization: "Bearer token-123" },
        }),
      );
    });

    it("rejects with the backend error message", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          json: async () => ({ success: false, error: "Forbidden" }),
        }),
      );
      await expect(listJobsites("t")).rejects.toThrow("Forbidden");
    });

    it("rejects with the generic message when the body is not JSON", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(badJsonResponse));
      await expect(listJobsites("t")).rejects.toThrow(GENERIC);
    });

    it("rejects with the generic message on an error response with no message", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          json: async () => ({ success: false }),
        }),
      );
      await expect(listJobsites("t")).rejects.toThrow(GENERIC);
    });
  });

  describe("createJobsite", () => {
    it("POSTs the name as JSON with the bearer token", async () => {
      const fetchMock = vi.fn().mockResolvedValue(okResponse({ id: "j1" }));
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        createJobsite("token-123", { name: "Riverside" }),
      ).resolves.toEqual({ id: "j1" });
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/jobsites",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer token-123",
          },
          body: JSON.stringify({ name: "Riverside" }),
        }),
      );
    });
  });

  describe("updateJobsite", () => {
    it("PATCHes the patch to /api/jobsites/:id", async () => {
      const fetchMock = vi.fn().mockResolvedValue(okResponse({ id: "j1" }));
      vi.stubGlobal("fetch", fetchMock);

      await updateJobsite("token-123", "j1", { archived: true });
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/jobsites/j1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ archived: true }),
        }),
      );
    });
  });

  describe("inviteSubcontractor", () => {
    it("POSTs the email to /api/jobsites/:id/invite and returns { email }", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(okResponse({ email: "a@b.com" }));
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        inviteSubcontractor("token-123", "j1", "a@b.com"),
      ).resolves.toEqual({ email: "a@b.com" });
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/jobsites/j1/invite",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ email: "a@b.com" }),
        }),
      );
    });
  });

  describe("removeSubcontractor", () => {
    it("DELETEs /api/jobsites/:id/subcontractors/:subId", async () => {
      const fetchMock = vi.fn().mockResolvedValue(okResponse({}));
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        removeSubcontractor("token-123", "j1", "s1"),
      ).resolves.toBeUndefined();
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/jobsites/j1/subcontractors/s1",
        expect.objectContaining({
          method: "DELETE",
          headers: { Authorization: "Bearer token-123" },
        }),
      );
    });

    it("rejects with the backend error message", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          json: async () => ({ success: false, error: "Not found" }),
        }),
      );
      await expect(removeSubcontractor("t", "j1", "s1")).rejects.toThrow(
        "Not found",
      );
    });
  });

  describe("getJobsiteInvitePreview", () => {
    it("GETs the public preview without an Authorization header", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(okResponse({ email: "a@b.com" }));
      vi.stubGlobal("fetch", fetchMock);

      await expect(getJobsiteInvitePreview("tok")).resolves.toEqual({
        email: "a@b.com",
      });
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/jobsites/invite/tok",
        expect.objectContaining({ method: "GET" }),
      );
      expect(fetchMock.mock.calls[0][1].headers).toBeUndefined();
    });

    it("rejects with the server message for an invalid token", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          json: async () => ({ success: false, error: "invalid or expired" }),
        }),
      );
      await expect(getJobsiteInvitePreview("tok")).rejects.toThrow(
        "invalid or expired",
      );
    });
  });

  describe("acceptJobsiteInvite", () => {
    it("POSTs to the accept endpoint with the bearer token and returns the project", async () => {
      const fetchMock = vi.fn().mockResolvedValue(okResponse({ id: "p1" }));
      vi.stubGlobal("fetch", fetchMock);

      await expect(acceptJobsiteInvite("token-123", "tok")).resolves.toEqual({
        id: "p1",
      });
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/jobsites/invite/tok/accept",
        expect.objectContaining({
          method: "POST",
          headers: { Authorization: "Bearer token-123" },
        }),
      );
    });
  });
});
