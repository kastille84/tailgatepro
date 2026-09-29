import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import { useUnsyncedProjectIds } from "../../src/hooks/useUnsyncedProjectIds";
import { enqueueMutation } from "../../src/utils/db/outbox";
import { tailgateDb } from "../../src/utils/db/tailgateDb";

afterEach(async () => {
  vi.restoreAllMocks();
  await tailgateDb.outbox.clear();
});

describe("useUnsyncedProjectIds", () => {
  it("starts empty when the outbox has nothing queued", async () => {
    const { result } = renderHook(() => useUnsyncedProjectIds());

    await waitFor(() => expect(result.current.size).toBe(0));
  });

  it("contains ids of projects whose create is queued, ignoring other rows", async () => {
    await enqueueMutation({
      entity: "project",
      entityId: "p-create",
      op: "create",
      payload: {},
    });
    await enqueueMutation({
      entity: "project",
      entityId: "p-update",
      op: "update",
      payload: {},
    });
    await enqueueMutation({
      entity: "talk",
      entityId: "t-create",
      op: "create",
      payload: {},
    });

    const { result } = renderHook(() => useUnsyncedProjectIds());

    await waitFor(() => expect([...result.current]).toEqual(["p-create"]));
  });

  it("drops an id once its create row leaves the outbox", async () => {
    const row = await enqueueMutation({
      entity: "project",
      entityId: "p1",
      op: "create",
      payload: {},
    });
    const { result } = renderHook(() => useUnsyncedProjectIds());
    await waitFor(() => expect(result.current.has("p1")).toBe(true));

    await tailgateDb.outbox.delete(row.id);

    await waitFor(() => expect(result.current.has("p1")).toBe(false));
  });

  it("picks up a create queued after mount", async () => {
    const { result } = renderHook(() => useUnsyncedProjectIds());
    await waitFor(() => expect(result.current.size).toBe(0));

    await enqueueMutation({
      entity: "project",
      entityId: "late",
      op: "create",
      payload: {},
    });

    await waitFor(() => expect(result.current.has("late")).toBe(true));
  });

  it("falls back to an empty set when the local read fails", async () => {
    await enqueueMutation({
      entity: "project",
      entityId: "p1",
      op: "create",
      payload: {},
    });
    vi.spyOn(tailgateDb.outbox, "toArray").mockRejectedValue(
      new Error("idb down"),
    );

    const { result } = renderHook(() => useUnsyncedProjectIds());

    await waitFor(() => expect(result.current.size).toBe(0));
  });
});
