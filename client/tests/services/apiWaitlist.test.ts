import { beforeEach, describe, expect, it, vi } from "vitest";

import { addToWaitlist } from "../../src/services/apiWaitlist";

describe("addToWaitlist", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("should POST the payload and resolve with the waitlist result", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          email: "alex@example.com",
          alreadyJoined: false,
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const payload = {
      name: "Alex Builder",
      email: "alex@example.com",
      company: "North Ridge Construction",
    };

    await expect(addToWaitlist(payload)).resolves.toEqual({
      email: "alex@example.com",
      alreadyJoined: false,
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  });

  it("should allow omitting the optional company field from the request payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            email: "builder@example.com",
            alreadyJoined: false,
          },
        }),
      }),
    );

    const payload = {
      name: "Alex Builder",
      email: "builder@example.com",
    };

    await expect(addToWaitlist(payload)).resolves.toEqual({
      email: "builder@example.com",
      alreadyJoined: false,
    });

    expect(global.fetch).toHaveBeenCalledWith("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  });

  it("should reject with the backend error message when the API responds with an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          success: false,
          error: "This email is already on the waitlist.",
        }),
      }),
    );

    await expect(
      addToWaitlist({
        name: "Alex Builder",
        email: "alex@example.com",
      }),
    ).rejects.toThrow("This email is already on the waitlist.");
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
      addToWaitlist({
        name: "Alex Builder",
        email: "alex@example.com",
      }),
    ).rejects.toThrow("Something went wrong. Please try again.");
  });

  it("should reject with the generic error when the API body is missing a success flag", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: false }),
      }),
    );

    await expect(
      addToWaitlist({
        name: "Alex Builder",
        email: "alex@example.com",
      }),
    ).rejects.toThrow("Something went wrong. Please try again.");
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
      addToWaitlist({
        name: "Alex Builder",
        email: "alex@example.com",
      }),
    ).rejects.toThrow("Something went wrong. Please try again.");
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
      addToWaitlist({
        name: "Alex Builder",
        email: "alex@example.com",
      }),
    ).rejects.toThrow("Something went wrong. Please try again.");
  });
});
