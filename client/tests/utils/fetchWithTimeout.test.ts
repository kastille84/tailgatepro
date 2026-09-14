import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_FETCH_TIMEOUT_MS,
  fetchWithTimeout,
} from "../../src/utils/fetchWithTimeout";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("fetchWithTimeout", () => {
  it("resolves with the response when fetch settles before the timeout", async () => {
    const response = { ok: true } as Response;
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchWithTimeout("/api/projects")).resolves.toBe(response);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("rejects once the request hangs past the timeout", async () => {
    vi.useFakeTimers();
    // A fetch that only ever settles if its signal aborts — simulates a
    // request that's accepted but never answered (see fetchWithTimeout.ts).
    const fetchMock = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const promise = fetchWithTimeout("/api/projects");
    const assertion = expect(promise).rejects.toMatchObject({
      name: "AbortError",
    });

    await vi.advanceTimersByTimeAsync(DEFAULT_FETCH_TIMEOUT_MS);
    await assertion;
  });

  it("respects a custom timeout", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const promise = fetchWithTimeout("/api/projects", {}, 500);
    const assertion = expect(promise).rejects.toMatchObject({
      name: "AbortError",
    });

    await vi.advanceTimersByTimeAsync(500);
    await assertion;
  });

  it("clears the timer once fetch settles, leaving no pending abort", async () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    await fetchWithTimeout("/api/projects");

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
