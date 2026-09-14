import React from "react";
import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useDeleteProject } from "../../src/hooks/useDeleteProject";
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

describe("useDeleteProject", () => {
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

  it("initializes with isDeleting false", () => {
    const { result } = renderHook(() => useDeleteProject(), { wrapper });
    expect(result.current.isDeleting).toBe(false);
  });

  it("runs mutationFn immediately even when TanStack Query's onlineManager reports offline", async () => {
    onlineManager.setOnline(false);
    vi.mocked(outbox.enqueueMutation).mockResolvedValue({} as never);

    const { result } = renderHook(() => useDeleteProject(), { wrapper });
    await result.current.deleteProject("p1");

    expect(outbox.enqueueMutation).toHaveBeenCalled();
  });

  it("enqueues a delete by id, toasts success", async () => {
    vi.mocked(outbox.enqueueMutation).mockResolvedValue({} as never);

    const { result } = renderHook(() => useDeleteProject(), { wrapper });
    await result.current.deleteProject("p1");

    expect(outbox.enqueueMutation).toHaveBeenCalledWith(
      { entity: "project", entityId: "p1", op: "delete", payload: {} },
      mockReplayer,
    );
    expect(toast.success).toHaveBeenCalledWith("Project deleted");
  });

  it("enqueues with no replayer when there is no signed-in session", async () => {
    mockUseAuth.mockReturnValue({ session: null });
    vi.mocked(outbox.enqueueMutation).mockResolvedValue({} as never);

    const { result } = renderHook(() => useDeleteProject(), { wrapper });
    await result.current.deleteProject("p1");

    expect(replayRegistry.createReplayer).not.toHaveBeenCalled();
    expect(outbox.enqueueMutation).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
    );
  });

  it("optimistically removes the project from the cached lists", async () => {
    vi.mocked(outbox.enqueueMutation).mockResolvedValue({} as never);
    queryClient.setQueryData(["projects", { includeArchived: false }], [
      project,
    ]);

    const { result } = renderHook(() => useDeleteProject(), { wrapper });
    await result.current.deleteProject("p1");

    expect(
      queryClient.getQueryData(["projects", { includeArchived: false }]),
    ).toEqual([]);
  });

  it("rolls back, toasts the error (e.g. the 409 archive-instead guard), and rejects", async () => {
    vi.mocked(outbox.enqueueMutation).mockRejectedValue(
      new Error(
        "This project has logged safety talks and can't be deleted. Archive it instead.",
      ),
    );
    queryClient.setQueryData(["projects", { includeArchived: false }], [
      project,
    ]);

    const { result } = renderHook(() => useDeleteProject(), { wrapper });

    await expect(result.current.deleteProject("p1")).rejects.toThrow(
      "Archive it instead.",
    );
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("Archive it instead."),
      ),
    );
    expect(
      queryClient.getQueryData(["projects", { includeArchived: false }]),
    ).toEqual([project]);
  });
});
