import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useUpdateProject } from "../../src/hooks/useUpdateProject";
import * as apiProjects from "../../src/services/apiProjects";

vi.mock("react-hot-toast");
vi.mock("../../src/services/apiProjects");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const project = {
  id: "p1",
  ownerCompanyId: "c1",
  name: "Site",
  gcCompanyId: null,
  gcNameCustom: "GC",
  status: "completed" as const,
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
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("initializes with isUpdating false", () => {
    const { result } = renderHook(() => useUpdateProject(), { wrapper });
    expect(result.current.isUpdating).toBe(false);
  });

  it("calls updateProject with the token, id and patch, then invalidates the projects query", async () => {
    vi.mocked(apiProjects.updateProject).mockResolvedValue(project);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateProject(), { wrapper });

    await result.current.updateProject({
      id: "p1",
      patch: { status: "completed" },
    });

    expect(apiProjects.updateProject).toHaveBeenCalledWith("token-123", "p1", {
      status: "completed",
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["projects"] });
  });

  it("toasts the error and rejects when the mutation fails", async () => {
    vi.mocked(apiProjects.updateProject).mockRejectedValue(
      new Error("Project not found"),
    );

    const { result } = renderHook(() => useUpdateProject(), { wrapper });

    await expect(
      result.current.updateProject({ id: "missing", patch: { name: "x" } }),
    ).rejects.toThrow("Project not found");

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Project not found"),
    );
  });
});
