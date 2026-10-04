import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DRAFT_ROW_ID,
  clearDraft,
  getActiveDraft,
  putDraft,
} from "../../../src/utils/db/meetingDraftCache";
import { tailgateDb } from "../../../src/utils/db/tailgateDb";

afterEach(async () => {
  await tailgateDb.meetingDraftCache.clear();
});

describe("getActiveDraft", () => {
  it("returns undefined when no draft has been written yet", async () => {
    expect(await getActiveDraft()).toBeUndefined();
  });
});

describe("putDraft", () => {
  it("writes the singleton row under the fixed draft id, round-tripping a Blob field", async () => {
    const blob = new Blob(["png-bytes"], { type: "image/png" });

    await putDraft({
      projectId: "project-1",
      talkId: "talk-1",
      status: "in_progress",
      updatedAt: "2024-01-01T00:00:00.000Z",
      data: { currentStep: "signatures", signers: [{ blob }] },
    });

    const row = await getActiveDraft();
    expect(row?.id).toBe(DRAFT_ROW_ID);
    expect(row?.projectId).toBe("project-1");
    expect(row?.talkId).toBe("talk-1");
    expect(row?.data.currentStep).toBe("signatures");
    // fake-indexeddb (this test environment's IndexedDB polyfill) doesn't
    // fully preserve Blob-ness through its structured clone -- see
    // mediaBlobs.test.ts's identical caveat. This only proves the value
    // round-trips at all; a real browser's IndexedDB clones Blob values
    // natively either way. See docs/meeting-flow-design.md.
    const signers = row?.data.signers as { blob: unknown }[];
    expect(signers[0].blob).toBeDefined();
  });

  it("replaces the previous draft rather than accumulating rows", async () => {
    await putDraft({
      projectId: "project-1",
      talkId: null,
      status: "in_progress",
      updatedAt: "2024-01-01T00:00:00.000Z",
      data: { currentStep: "project", signers: [] },
    });
    await putDraft({
      projectId: "project-2",
      talkId: null,
      status: "in_progress",
      updatedAt: "2024-01-02T00:00:00.000Z",
      data: { currentStep: "talk", signers: [] },
    });

    expect((await tailgateDb.meetingDraftCache.toArray()).length).toBe(1);
    expect((await getActiveDraft())?.projectId).toBe("project-2");
  });

  it("rejects with a TimeoutError instead of hanging forever when the local write never settles", async () => {
    vi.useFakeTimers();
    const putSpy = vi
      .spyOn(tailgateDb.meetingDraftCache, "put")
      .mockReturnValue(new Promise(() => {}) as never);

    const promise = putDraft({
      projectId: "project-1",
      talkId: null,
      status: "in_progress",
      updatedAt: "2024-01-01T00:00:00.000Z",
      data: { currentStep: "project", signers: [] },
    });
    const assertion = expect(promise).rejects.toMatchObject({
      name: "TimeoutError",
    });

    await vi.advanceTimersByTimeAsync(5000);
    await assertion;

    putSpy.mockRestore();
    vi.useRealTimers();
  });
});

describe("clearDraft", () => {
  it("removes the draft row", async () => {
    await putDraft({
      projectId: "project-1",
      talkId: null,
      status: "in_progress",
      updatedAt: "2024-01-01T00:00:00.000Z",
      data: { currentStep: "project", signers: [] },
    });

    await clearDraft();

    expect(await getActiveDraft()).toBeUndefined();
  });

  it("rejects with a TimeoutError instead of hanging forever when the local write never settles", async () => {
    vi.useFakeTimers();
    const deleteSpy = vi
      .spyOn(tailgateDb.meetingDraftCache, "delete")
      .mockReturnValue(new Promise(() => {}) as never);

    const promise = clearDraft();
    const assertion = expect(promise).rejects.toMatchObject({
      name: "TimeoutError",
    });

    await vi.advanceTimersByTimeAsync(5000);
    await assertion;

    deleteSpy.mockRestore();
    vi.useRealTimers();
  });
});
