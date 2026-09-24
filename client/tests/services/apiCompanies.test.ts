import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getCompanyLogoUrl,
  getInvitePreview,
  getJoinCode,
  getMyCompany,
  inviteTeammate,
  uploadCompanyLogo,
} from "../../src/services/apiCompanies";
import { DEFAULT_FETCH_TIMEOUT_MS } from "../../src/utils/fetchWithTimeout";

const GENERIC = "Something went wrong. Please try again.";

const company = {
  id: "company-1",
  name: "Acme Roofing",
  companyType: "subcontractor",
  tier: "premium",
  logoPath: "company-1/logo",
};

describe("apiCompanies", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getMyCompany", () => {
    it("GETs /api/companies/me with the bearer token and returns the company", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: company }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(getMyCompany("token-123")).resolves.toEqual(company);
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/companies/me",
        expect.objectContaining({
          method: "GET",
          headers: { Authorization: "Bearer token-123" },
        }),
      );
    });

    it("rejects with the backend error message on an error response", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          json: async () => ({ success: false, error: "Boom" }),
        }),
      );
      await expect(getMyCompany("token-123")).rejects.toThrow("Boom");
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
      await expect(getMyCompany("token-123")).rejects.toThrow(GENERIC);
    });
  });

  describe("getCompanyLogoUrl", () => {
    it("GETs /api/companies/logo-url with the bearer token and returns the url", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { url: "https://signed.example/logo.png" },
        }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(getCompanyLogoUrl("token-123")).resolves.toBe(
        "https://signed.example/logo.png",
      );
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/companies/logo-url",
        expect.objectContaining({
          method: "GET",
          headers: { Authorization: "Bearer token-123" },
          signal: expect.any(AbortSignal),
        }),
      );
    });

    it("resolves null on a 404 (no logo uploaded yet) without treating it as an error", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ success: false, error: "Not found" }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(getCompanyLogoUrl("token-123")).resolves.toBeNull();
    });

    it("rejects with the backend error message on a non-404 error response", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          json: async () => ({ success: false, error: "Forbidden" }),
        }),
      );
      await expect(getCompanyLogoUrl("token-123")).rejects.toThrow("Forbidden");
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
      await expect(getCompanyLogoUrl("token-123")).rejects.toThrow(GENERIC);
    });
  });

  describe("getJoinCode", () => {
    it("GETs /api/companies/join-code with the bearer token and returns the code", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { joinCode: "K7M2Q9XB" } }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(getJoinCode("token-123")).resolves.toBe("K7M2Q9XB");
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/companies/join-code",
        expect.objectContaining({
          method: "GET",
          headers: { Authorization: "Bearer token-123" },
        }),
      );
    });

    it("rejects with the backend error message on a 403 (not a GC)", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          json: async () => ({ success: false, error: "Forbidden" }),
        }),
      );
      await expect(getJoinCode("token-123")).rejects.toThrow("Forbidden");
    });

    it("rejects with the generic message when the response has no body", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          json: async () => null,
        }),
      );
      await expect(getJoinCode("token-123")).rejects.toThrow(GENERIC);
    });
  });

  describe("uploadCompanyLogo", () => {
    it("PUTs the raw blob body with the blob's content type and returns the updated company", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: company }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const blob = new Blob(["png-bytes"], { type: "image/png" });

      await expect(uploadCompanyLogo("token-123", blob)).resolves.toEqual(
        company,
      );

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/companies/logo");
      expect(options.method).toBe("PUT");
      expect(options.headers.Authorization).toBe("Bearer token-123");
      expect(options.headers["Content-Type"]).toBe("image/png");
      expect(options.body).toBe(blob);
    });

    it("falls back to image/png when the blob has no type", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: company }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const blob = new Blob(["png-bytes"]);
      await uploadCompanyLogo("token-123", blob);

      const [, options] = fetchMock.mock.calls[0];
      expect(options.headers["Content-Type"]).toBe("image/png");
    });

    it("rejects with the backend error message on a 403 (tier not entitled)", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          json: async () => ({
            success: false,
            error: "Upgrade to Trade Pro to upload a company logo",
          }),
        }),
      );
      await expect(
        uploadCompanyLogo("token-123", new Blob(["x"], { type: "image/png" })),
      ).rejects.toThrow("Upgrade to Trade Pro");
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
        uploadCompanyLogo("token-123", new Blob(["x"], { type: "image/png" })),
      ).rejects.toThrow(GENERIC);
    });

    it("rejects (rather than hanging forever) when the request never gets a response", async () => {
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

      const promise = uploadCompanyLogo(
        "token-123",
        new Blob(["x"], { type: "image/png" }),
      );
      const assertion = expect(promise).rejects.toMatchObject({
        name: "AbortError",
      });

      await vi.advanceTimersByTimeAsync(DEFAULT_FETCH_TIMEOUT_MS);
      await assertion;

      vi.useRealTimers();
    });
  });

  describe("getInvitePreview", () => {
    const preview = {
      companyName: "Rivera Electric",
      email: "newhire@example.com",
      role: "foreman",
    };

    it("GETs /api/companies/invite/:token with no auth header and returns the preview", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: preview }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(getInvitePreview("a".repeat(64))).resolves.toEqual(preview);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe(`/api/companies/invite/${"a".repeat(64)}`);
      expect(options.method).toBe("GET");
      expect(options.headers).toBeUndefined();
    });

    it("rejects with the backend error message on an invalid/expired token", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          json: async () => ({
            success: false,
            error: "This invite link is invalid or has expired",
          }),
        }),
      );
      await expect(getInvitePreview("bad-token")).rejects.toThrow(
        "This invite link is invalid or has expired",
      );
    });

    it("rejects with the generic message when the response has no body", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          json: async () => null,
        }),
      );
      await expect(getInvitePreview("a".repeat(64))).rejects.toThrow(GENERIC);
    });
  });

  describe("inviteTeammate", () => {
    const result = { email: "newhire@example.com", role: "foreman" };

    it("POSTs /api/companies/invite with the bearer token and JSON body, returning { email, role }", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ success: true, data: result }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        inviteTeammate("token-123", { email: "newhire@example.com", role: "foreman" }),
      ).resolves.toEqual(result);

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/companies/invite");
      expect(options.method).toBe("POST");
      expect(options.headers).toEqual({
        "Content-Type": "application/json",
        Authorization: "Bearer token-123",
      });
      expect(JSON.parse(options.body)).toEqual({
        email: "newhire@example.com",
        role: "foreman",
      });
    });

    it("rejects with the backend error message on a 403 (not a manager)", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          json: async () => ({
            success: false,
            error: "You don't have permission to do this",
          }),
        }),
      );
      await expect(
        inviteTeammate("token-123", { email: "newhire@example.com", role: "admin" }),
      ).rejects.toThrow("You don't have permission to do this");
    });

    it("rejects with the generic message when the response has no body", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          json: async () => null,
        }),
      );
      await expect(
        inviteTeammate("token-123", { email: "newhire@example.com", role: "foreman" }),
      ).rejects.toThrow(GENERIC);
    });
  });
});
