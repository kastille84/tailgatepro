import { beforeEach, describe, expect, it, vi } from "vitest";

import { createProfile } from "../../src/services/apiUsers";

describe("createProfile", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("should POST the body (without accessToken) and send it as a Bearer header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          id: "user-1",
          name: "Alex Builder",
          role: "foreman",
          companyId: "company-1",
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const payload = {
      name: "Alex Builder",
      companyName: "Rivera Electric",
      companyType: "subcontractor" as const,
      accessToken: "token-123",
    };

    await expect(createProfile(payload)).resolves.toEqual({
      id: "user-1",
      name: "Alex Builder",
      role: "foreman",
      companyId: "company-1",
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/users/profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token-123",
      },
      body: JSON.stringify({
        name: "Alex Builder",
        companyName: "Rivera Electric",
        companyType: "subcontractor",
      }),
    });
  });

  it("should reject with the backend error message when the API responds with an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          success: false,
          error: "Profile already exists for this account",
        }),
      }),
    );

    await expect(
      createProfile({
        name: "Alex Builder",
        companyName: "Rivera Electric",
        companyType: "gc",
        accessToken: "token-123",
      }),
    ).rejects.toThrow("Profile already exists for this account");
  });

  it("should reject with the generic error when the HTTP response is unsuccessful without a backend message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ success: false }),
      }),
    );

    await expect(
      createProfile({
        name: "Alex Builder",
        companyName: "Rivera Electric",
        companyType: "gc",
        accessToken: "token-123",
      }),
    ).rejects.toThrow("Could not finish setting up your account.");
  });

  it("should reject with the generic error when the API body is empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => null,
      }),
    );

    await expect(
      createProfile({
        name: "Alex Builder",
        companyName: "Rivera Electric",
        companyType: "gc",
        accessToken: "token-123",
      }),
    ).rejects.toThrow("Could not finish setting up your account.");
  });

  it("should reject with the generic error when the response body is malformed JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      }),
    );

    await expect(
      createProfile({
        name: "Alex Builder",
        companyName: "Rivera Electric",
        companyType: "gc",
        accessToken: "token-123",
      }),
    ).rejects.toThrow("Could not finish setting up your account.");
  });
});
