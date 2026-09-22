import React from "react";
import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useCreateProject } from "../../src/hooks/useCreateProject";
import * as outbox from "../../src/utils/db/outbox";
import * as replayRegistry from "../../src/utils/db/replayRegistry";

vi.mock("react-hot-toast");
vi.mock("../../src/utils/db/outbox");
vi.mock("../../src/utils/db/replayRegistry");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const mockReplayer = vi.fn();

describe("useCreateProject", () => {
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

  it("initializes with isCreating false", () => {
    const { result } = renderHook(() => useCreateProject(), { wrapper });
    expect(result.current.isCreating).toBe(false);
  });

  it("runs mutationFn immediately even when TanStack Query's onlineManager reports offline", async () => {
    // Without networkMode: "always", the default networkMode: "online" would
    // pause mutationFn — the outbox write included — until onlineManager
    // sees an `online` event, instead of running immediately and letting the
    // outbox's own navigator.onLine check decide what happens next.
    onlineManager.setOnline(false);
    vi.mocked(outbox.enqueueMutation).mockResolvedValue({} as never);

    const { result } = renderHook(() => useCreateProject(), { wrapper });
    await result.current.createProject({ name: "Site", gcNameCustom: "GC" });

    expect(outbox.enqueueMutation).toHaveBeenCalled();
  });

  it("enqueues a create with a generated id and the given replayer", async () => {
    vi.mocked(outbox.enqueueMutation).mockResolvedValue({} as never);

    const { result } = renderHook(() => useCreateProject(), { wrapper });
    await result.current.createProject({ name: "Site", gcNameCustom: "GC" });

    expect(replayRegistry.createReplayer).toHaveBeenCalledWith("token-123");
    expect(outbox.enqueueMutation).toHaveBeenCalledWith(
      {
        entity: "project",
        entityId: expect.stringMatching(UUID_RE),
        op: "create",
        payload: expect.objectContaining({
          id: expect.stringMatching(UUID_RE),
          name: "Site",
          gcNameCustom: "GC",
        }),
      },
      mockReplayer,
    );
  });

  it("optimistically adds the new project to the cached projects lists", async () => {
    vi.mocked(outbox.enqueueMutation).mockResolvedValue({} as never);
    queryClient.setQueryData(["projects", { includeArchived: false }], []);

    const { result } = renderHook(() => useCreateProject(), { wrapper });
    await result.current.createProject({
      name: "Site",
      gcNameCustom: "GC",
      gcContactEmail: "gc@example.com",
    });

    const cached = queryClient.getQueryData<{ name: string }[]>([
      "projects",
      { includeArchived: false },
    ]);
    expect(cached).toHaveLength(1);
    expect(cached?.[0]).toMatchObject({
      name: "Site",
      gcNameCustom: "GC",
      gcContactEmail: "gc@example.com",
    });
  });

  it("defaults gcNameCustom/gcContactEmail to null on the optimistic entry when omitted, and never links a GC", async () => {
    vi.mocked(outbox.enqueueMutation).mockResolvedValue({} as never);
    queryClient.setQueryData(["projects", { includeArchived: false }], []);

    const { result } = renderHook(() => useCreateProject(), { wrapper });
    await result.current.createProject({ name: "Site" });

    const cached = queryClient.getQueryData<
      {
        gcCompanyId: string | null;
        gcNameCustom: string | null;
        gcContactEmail: string | null;
      }[]
    >(["projects", { includeArchived: false }]);
    expect(cached?.[0]).toMatchObject({
      gcCompanyId: null,
      gcNameCustom: null,
      gcContactEmail: null,
    });
  });

  it("enqueues with no replayer when there is no signed-in session", async () => {
    mockUseAuth.mockReturnValue({ session: null });
    vi.mocked(outbox.enqueueMutation).mockResolvedValue({} as never);

    const { result } = renderHook(() => useCreateProject(), { wrapper });
    await result.current.createProject({ name: "Site", gcNameCustom: "GC" });

    expect(replayRegistry.createReplayer).not.toHaveBeenCalled();
    expect(outbox.enqueueMutation).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
    );
  });

  it("rolls back the optimistic entry, toasts, and rejects when enqueue fails", async () => {
    vi.mocked(outbox.enqueueMutation).mockRejectedValue(
      new Error("A general contractor is required"),
    );
    queryClient.setQueryData(["projects", { includeArchived: false }], []);

    const { result } = renderHook(() => useCreateProject(), { wrapper });

    await expect(
      result.current.createProject({ name: "Site", gcNameCustom: "GC" }),
    ).rejects.toThrow("A general contractor is required");

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "A general contractor is required",
      ),
    );
    expect(
      queryClient.getQueryData(["projects", { includeArchived: false }]),
    ).toEqual([]);
  });
});
