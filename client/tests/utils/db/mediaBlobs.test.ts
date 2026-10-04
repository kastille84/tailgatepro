import { afterEach, describe, expect, it, vi } from "vitest";

import {
  deleteMediaBlob,
  getMediaBlob,
  storeMediaBlob,
} from "../../../src/utils/db/mediaBlobs";
import { tailgateDb } from "../../../src/utils/db/tailgateDb";

afterEach(async () => {
  await tailgateDb.mediaBlobs.clear();
});

describe("storeMediaBlob", () => {
  it("stores the blob and returns a generated id it can be read back by", async () => {
    const blob = new Blob(["png-bytes"], { type: "image/png" });

    const id = await storeMediaBlob(blob);
    const stored = await getMediaBlob(id);

    expect(stored?.id).toBe(id);
    expect(stored?.mimeType).toBe("image/png");
    // fake-indexeddb (this test environment's IndexedDB polyfill) doesn't
    // fully preserve Blob-ness through its structured clone, so this only
    // proves a value round-trips at all — a real browser's IndexedDB clones
    // Blob values natively either way. See docs/meeting-flow-design.md.
    expect(stored?.blob).toBeDefined();
  });

  it("rejects with a TimeoutError instead of hanging forever when the local write never settles", async () => {
    vi.useFakeTimers();
    const addSpy = vi
      .spyOn(tailgateDb.mediaBlobs, "add")
      .mockReturnValue(new Promise(() => {}) as never);

    const promise = storeMediaBlob(new Blob(["x"], { type: "image/png" }));
    const assertion = expect(promise).rejects.toMatchObject({
      name: "TimeoutError",
    });

    await vi.advanceTimersByTimeAsync(5000);
    await assertion;

    addSpy.mockRestore();
    vi.useRealTimers();
  });
});

describe("getMediaBlob", () => {
  it("returns undefined for an id that was never stored, or already deleted", async () => {
    expect(await getMediaBlob("missing")).toBeUndefined();
  });
});

describe("deleteMediaBlob", () => {
  it("removes a stored blob", async () => {
    const id = await storeMediaBlob(new Blob(["x"], { type: "image/png" }));

    await deleteMediaBlob(id);

    expect(await getMediaBlob(id)).toBeUndefined();
  });

  it("rejects with a TimeoutError instead of hanging forever when the local write never settles", async () => {
    vi.useFakeTimers();
    const deleteSpy = vi
      .spyOn(tailgateDb.mediaBlobs, "delete")
      .mockReturnValue(new Promise(() => {}) as never);

    const promise = deleteMediaBlob("some-id");
    const assertion = expect(promise).rejects.toMatchObject({
      name: "TimeoutError",
    });

    await vi.advanceTimersByTimeAsync(5000);
    await assertion;

    deleteSpy.mockRestore();
    vi.useRealTimers();
  });
});
