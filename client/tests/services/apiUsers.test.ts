import { beforeEach, describe, expect, it, vi } from "vitest";

import { createProfile } from "../../src/services/apiUsers";

describe("createProfile", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("should POST an empty body with the access token as a Bearer header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
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

    await expect(createProfile({ accessToken: "token-123" })).resolves.toEqual({
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
      body: JSON.stringify({}),
    });
  });

  it("should resolve null when the profile already exists (HTTP 409)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({
          success: false,
          error: "Profile already exists for this account",
        }),
      }),
    );

    await expect(
      createProfile({ accessToken: "token-123" }),
    ).resolves.toBeNull();
  });

  it("should reject with the backend error message on a non-409 error response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({
          success: false,
          error: "Profile details are incomplete",
        }),
      }),
    );

    await expect(
      createProfile({ accessToken: "token-123" }),
    ).rejects.toThrow("Profile details are incomplete");
  });

  it("should reject with the generic error when the HTTP response is unsuccessful without a backend message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ success: false }),
      }),
    );

    await expect(
      createProfile({ accessToken: "token-123" }),
    ).rejects.toThrow("Could not finish setting up your account.");
  });

  it("should reject with the generic error when the API body is empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => null,
      }),
    );

    await expect(
      createProfile({ accessToken: "token-123" }),
    ).rejects.toThrow("Could not finish setting up your account.");
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

    await expect(
      createProfile({ accessToken: "token-123" }),
    ).rejects.toThrow("Could not finish setting up your account.");
  });
});
