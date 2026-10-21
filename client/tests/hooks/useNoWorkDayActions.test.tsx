import React from "react";
import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useNoWorkDayActions } from "../../src/hooks/useNoWorkDayActions";
import * as outbox from "../../src/utils/db/outbox";
import * as replayRegistry from "../../src/utils/db/replayRegistry";
import type { NoWorkDay } from "../../src/interfaces/noWorkDay";

vi.mock("react-hot-toast");
vi.mock("../../src/utils/db/outbox");
vi.mock("../../src/utils/db/replayRegistry");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const mockReplayer = vi.fn();
const KEY = ["no-work-days", "p1"];

const existing: NoWorkDay = {
  id: "old-1",
  jobsiteId: "j1",
  companyId: "c1",
  offDate: "2026-11-30",
  reason: "weather",
  createdBy: "u1",
  createdAt: "2026-11-20T00:00:00.000Z",
};

describe("useNoWorkDayActions", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ session: { access_token: "token-123" } });
    vi.mocked(replayRegistry.createReplayer).mockReturnValue(mockReplayer);
    vi.mocked(outbox.enqueueMutation).mockResolvedValue({} as never);
  });

  afterEach(() => {
    onlineManager.setOnline(true);
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe("markDayOff", () => {
    const input = { projectId: "p1", offDate: "2026-11-26", reason: "holiday" as const };

    it("runs immediately even when TanStack Query's onlineManager reports offline", async () => {
      onlineManager.setOnline(false);
      const { result } = renderHook(() => useNoWorkDayActions(), { wrapper });

      await act(() => result.current.markDayOff(input));

      expect(outbox.enqueueMutation).toHaveBeenCalled();
    });

    it("enqueues a create with a generated id, depending on the project, with the replayer", async () => {
      const { result } = renderHook(() => useNoWorkDayActions(), { wrapper });

      await act(() => result.current.markDayOff(input));

      const [enqueued, replayer] = vi.mocked(outbox.enqueueMutation).mock.calls[0];
      expect(enqueued.entity).toBe("no_work_day");
      expect(enqueued.op).toBe("create");
      expect(enqueued.entityId).toMatch(UUID_RE);
      expect(enqueued.payload).toEqual({ id: enqueued.entityId, ...input });
      expect(enqueued.dependsOnEntityIds).toEqual(["p1"]);
      expect(replayRegistry.createReplayer).toHaveBeenCalledWith("token-123");
      expect(replayer).toBe(mockReplayer);
    });

    it("enqueues with no replayer when there is no signed-in session", async () => {
      mockUseAuth.mockReturnValue({ session: null });
      const { result } = renderHook(() => useNoWorkDayActions(), { wrapper });

      await act(() => result.current.markDayOff(input));

      expect(replayRegistry.createReplayer).not.toHaveBeenCalled();
      expect(outbox.enqueueMutation).toHaveBeenCalledWith(expect.anything(), undefined);
    });

    it("adds the mark to the cached list, kept in date order", async () => {
      queryClient.setQueryData(KEY, [existing]);
      const { result } = renderHook(() => useNoWorkDayActions(), { wrapper });

      await act(() => result.current.markDayOff(input));

      const cached = queryClient.getQueryData<NoWorkDay[]>(KEY)!;
      expect(cached.map((day) => day.offDate)).toEqual(["2026-11-26", "2026-11-30"]);
      expect(cached[0]).toMatchObject({ reason: "holiday", createdBy: null });
    });

    it("starts a list when nothing was cached yet", async () => {
      const { result } = renderHook(() => useNoWorkDayActions(), { wrapper });

      await act(() => result.current.markDayOff(input));

      expect(queryClient.getQueryData<NoWorkDay[]>(KEY)).toHaveLength(1);
    });

    it("rolls the cache back and toasts when the write is rejected", async () => {
      queryClient.setQueryData(KEY, [existing]);
      vi.mocked(outbox.enqueueMutation).mockRejectedValue(new Error("Project not found"));
      const { result } = renderHook(() => useNoWorkDayActions(), { wrapper });

      await act(async () => {
        await expect(result.current.markDayOff(input)).rejects.toThrow("Project not found");
      });

      expect(queryClient.getQueryData(KEY)).toEqual([existing]);
      expect(toast.error).toHaveBeenCalledWith("Project not found");
    });
  });

  describe("removeDayOff", () => {
    it("enqueues a delete for the mark's id, depending on the project", async () => {
      const { result } = renderHook(() => useNoWorkDayActions(), { wrapper });

      await act(() => result.current.removeDayOff({ id: "old-1", projectId: "p1" }));

      expect(outbox.enqueueMutation).toHaveBeenCalledWith(
        {
          entity: "no_work_day",
          entityId: "old-1",
          op: "delete",
          payload: {},
          dependsOnEntityIds: ["p1"],
        },
        mockReplayer,
      );
    });

    it("enqueues with no replayer when there is no signed-in session", async () => {
      mockUseAuth.mockReturnValue({ session: null });
      const { result } = renderHook(() => useNoWorkDayActions(), { wrapper });

      await act(() => result.current.removeDayOff({ id: "old-1", projectId: "p1" }));

      expect(outbox.enqueueMutation).toHaveBeenCalledWith(expect.anything(), undefined);
    });

    it("removes the mark from the cached list", async () => {
      queryClient.setQueryData(KEY, [existing]);
      const { result } = renderHook(() => useNoWorkDayActions(), { wrapper });

      await act(() => result.current.removeDayOff({ id: "old-1", projectId: "p1" }));

      expect(queryClient.getQueryData(KEY)).toEqual([]);
    });

    it("treats a missing cache as an empty list", async () => {
      const { result } = renderHook(() => useNoWorkDayActions(), { wrapper });

      await act(() => result.current.removeDayOff({ id: "old-1", projectId: "p1" }));

      expect(queryClient.getQueryData(KEY)).toEqual([]);
    });

    it("restores the cache and toasts when the write is rejected", async () => {
      queryClient.setQueryData(KEY, [existing]);
      vi.mocked(outbox.enqueueMutation).mockRejectedValue(new Error("too old"));
      const { result } = renderHook(() => useNoWorkDayActions(), { wrapper });

      await act(async () => {
        await expect(
          result.current.removeDayOff({ id: "old-1", projectId: "p1" }),
        ).rejects.toThrow("too old");
      });

      expect(queryClient.getQueryData(KEY)).toEqual([existing]);
      expect(toast.error).toHaveBeenCalledWith("too old");
    });
  });
});
