import React from "react";
import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useUpdateProject } from "../../src/hooks/useUpdateProject";
import * as outbox from "../../src/utils/db/outbox";
import * as replayRegistry from "../../src/utils/db/replayRegistry";

vi.mock("react-hot-toast");
vi.mock("../../src/utils/db/outbox");
vi.mock("../../src/utils/db/replayRegistry");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockReplayer = vi.fn();

const project = {
  id: "p1",
  ownerCompanyId: "c1",
  name: "Site",
  gcCompanyId: null,
  gcNameCustom: "GC",
  gcContactEmail: null,
  status: "active" as const,
  archivedAt: null,
  createdAt: "2026-09-09",
};

describe("useUpdateProject", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ session: { access_token: "token-123" } });
    vi.mocked(replayRegistry.createReplayer).mockReturnValue(mockReplayer);
  });

  afterEach(() => {
    onlineManager.setOnline(true);
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("initializes with isUpdating false", () => {
    const { result } = renderHook(() => useUpdateProject(), { wrapper });
    expect(result.current.isUpdating).toBe(false);
  });

  it("runs mutationFn immediately even when TanStack Query's onlineManager reports offline", async () => {
    onlineManager.setOnline(false);
    vi.mocked(outbox.enqueueMutation).mockResolvedValue({} as never);

    const { result } = renderHook(() => useUpdateProject(), { wrapper });
    await result.current.updateProject({ id: "p1", patch: { name: "x" } });

    expect(outbox.enqueueMutation).toHaveBeenCalled();
  });

  it("enqueues an update with the id, patch, and the given replayer", async () => {
    vi.mocked(outbox.enqueueMutation).mockResolvedValue({} as never);

    const { result } = renderHook(() => useUpdateProject(), { wrapper });
    await result.current.updateProject({
      id: "p1",
      patch: { status: "completed" },
    });

    expect(replayRegistry.createReplayer).toHaveBeenCalledWith("token-123");
    expect(outbox.enqueueMutation).toHaveBeenCalledWith(
      {
        entity: "project",
        entityId: "p1",
        op: "update",
        payload: { status: "completed" },
      },
      mockReplayer,
    );
  });

  it("enqueues with no replayer when there is no signed-in session", async () => {
    mockUseAuth.mockReturnValue({ session: null });
    vi.mocked(outbox.enqueueMutation).mockResolvedValue({} as never);

    const { result } = renderHook(() => useUpdateProject(), { wrapper });
    await result.current.updateProject({ id: "p1", patch: { name: "x" } });

    expect(replayRegistry.createReplayer).not.toHaveBeenCalled();
    expect(outbox.enqueueMutation).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
    );
  });

  it("optimistically merges the patch onto the cached project", async () => {
    vi.mocked(outbox.enqueueMutation).mockResolvedValue({} as never);
    queryClient.setQueryData(["projects", { includeArchived: false }], [
      project,
    ]);

    const { result } = renderHook(() => useUpdateProject(), { wrapper });
    await result.current.updateProject({
      id: "p1",
      patch: { name: "New name" },
    });

    const cached = queryClient.getQueryData<{ name: string }[]>([
      "projects",
      { includeArchived: false },
    ]);
    expect(cached?.[0]).toMatchObject({ id: "p1", name: "New name" });
  });

  it("rolls back the optimistic patch, toasts, and rejects when the mutation fails", async () => {
    vi.mocked(outbox.enqueueMutation).mockRejectedValue(
      new Error("Project not found"),
    );
    queryClient.setQueryData(["projects", { includeArchived: false }], [
      project,
    ]);

    const { result } = renderHook(() => useUpdateProject(), { wrapper });

    await expect(
      result.current.updateProject({ id: "p1", patch: { name: "x" } }),
    ).rejects.toThrow("Project not found");

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Project not found"),
    );
    expect(
      queryClient.getQueryData(["projects", { includeArchived: false }]),
    ).toEqual([project]);
  });
});
