import React from "react";
import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useArchiveProject } from "../../src/hooks/useArchiveProject";
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
  status: "active" as const,
  archivedAt: null,
  createdAt: "2026-09-09",
};

describe("useArchiveProject", () => {
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

  it("runs mutationFn immediately even when TanStack Query's onlineManager reports offline", async () => {
    onlineManager.setOnline(false);
    vi.mocked(outbox.enqueueMutation).mockResolvedValue({} as never);

    const { result } = renderHook(() => useArchiveProject(), { wrapper });
    await result.current.archiveProject({ id: "p1", archived: true });

    expect(outbox.enqueueMutation).toHaveBeenCalled();
  });

  it("enqueues an archive op with the id and archived flag, toasts 'archived'", async () => {
    vi.mocked(outbox.enqueueMutation).mockResolvedValue({} as never);

    const { result } = renderHook(() => useArchiveProject(), { wrapper });
    await result.current.archiveProject({ id: "p1", archived: true });

    expect(outbox.enqueueMutation).toHaveBeenCalledWith(
      {
        entity: "project",
        entityId: "p1",
        op: "archive",
        payload: { archived: true },
      },
      mockReplayer,
    );
    expect(toast.success).toHaveBeenCalledWith("Project archived");
  });

  it("toasts 'restored' when archived is false", async () => {
    vi.mocked(outbox.enqueueMutation).mockResolvedValue({} as never);

    const { result } = renderHook(() => useArchiveProject(), { wrapper });
    await result.current.archiveProject({ id: "p1", archived: false });

    expect(toast.success).toHaveBeenCalledWith("Project restored");
  });

  it("enqueues with no replayer when there is no signed-in session", async () => {
    mockUseAuth.mockReturnValue({ session: null });
    vi.mocked(outbox.enqueueMutation).mockResolvedValue({} as never);

    const { result } = renderHook(() => useArchiveProject(), { wrapper });
    await result.current.archiveProject({ id: "p1", archived: true });

    expect(replayRegistry.createReplayer).not.toHaveBeenCalled();
    expect(outbox.enqueueMutation).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
    );
  });

  it("optimistically moves the cached project out of the default view when archiving", async () => {
    vi.mocked(outbox.enqueueMutation).mockResolvedValue({} as never);
    queryClient.setQueryData(["projects", { includeArchived: false }], [
      project,
    ]);
    queryClient.setQueryData(["projects", { includeArchived: true }], [
      project,
    ]);

    const { result } = renderHook(() => useArchiveProject(), { wrapper });
    await result.current.archiveProject({ id: "p1", archived: true });

    expect(
      queryClient.getQueryData(["projects", { includeArchived: false }]),
    ).toEqual([]);
    const archivedView = queryClient.getQueryData<{ archivedAt: string | null }[]>(
      ["projects", { includeArchived: true }],
    );
    expect(archivedView?.[0].archivedAt).not.toBeNull();
  });

  it("rolls back the optimistic move, toasts the error, and rejects when the mutation fails", async () => {
    vi.mocked(outbox.enqueueMutation).mockRejectedValue(
      new Error("Project not found"),
    );
    queryClient.setQueryData(["projects", { includeArchived: false }], [
      project,
    ]);

    const { result } = renderHook(() => useArchiveProject(), { wrapper });

    await expect(
      result.current.archiveProject({ id: "missing", archived: true }),
    ).rejects.toThrow("Project not found");
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Project not found"),
    );
    expect(
      queryClient.getQueryData(["projects", { includeArchived: false }]),
    ).toEqual([project]);
  });
});
