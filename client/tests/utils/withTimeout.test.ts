import { afterEach, describe, expect, it, vi } from "vitest";

import { TimeoutError, withTimeout } from "../../src/utils/withTimeout";

afterEach(() => {
  vi.useRealTimers();
});

describe("withTimeout", () => {
  it("resolves with the wrapped promise's value when it settles first", async () => {
    await expect(withTimeout(Promise.resolve("done"), 1000)).resolves.toBe(
      "done",
    );
  });

  it("rejects with the wrapped promise's error when it rejects first", async () => {
    await expect(
      withTimeout(Promise.reject(new Error("boom")), 1000),
    ).rejects.toThrow("boom");
  });

  it("rejects with a TimeoutError once the timeout elapses before the promise settles", async () => {
    vi.useFakeTimers();
    const neverSettles = new Promise(() => {});

    const promise = withTimeout(neverSettles, 5000, "took too long");
    const assertion = expect(promise).rejects.toThrow(TimeoutError);

    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
  });

  it("uses the given message on timeout", async () => {
    vi.useFakeTimers();
    const neverSettles = new Promise(() => {});

    const promise = withTimeout(neverSettles, 100, "took too long");
    const assertion = expect(promise).rejects.toThrow("took too long");

    await vi.advanceTimersByTimeAsync(100);
    await assertion;
  });

  it("does not reject with a timeout once the promise has already resolved", async () => {
    vi.useFakeTimers();
    let resolveIt!: (value: string) => void;
    const controlled = new Promise<string>((resolve) => {
      resolveIt = resolve;
    });

    const promise = withTimeout(controlled, 1000);
    resolveIt("done");
    await vi.advanceTimersByTimeAsync(2000);

    await expect(promise).resolves.toBe("done");
  });
});
