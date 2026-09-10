import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useArchiveProject } from "../../src/hooks/useArchiveProject";
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
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("patches archived:true, toasts 'archived', and invalidates the projects query", async () => {
    vi.mocked(apiProjects.updateProject).mockResolvedValue(project);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useArchiveProject(), { wrapper });
    await result.current.archiveProject({ id: "p1", archived: true });

    expect(apiProjects.updateProject).toHaveBeenCalledWith("token-123", "p1", {
      archived: true,
    });
    expect(toast.success).toHaveBeenCalledWith("Project archived");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["projects"] });
  });

  it("toasts 'restored' when archived is false", async () => {
    vi.mocked(apiProjects.updateProject).mockResolvedValue(project);

    const { result } = renderHook(() => useArchiveProject(), { wrapper });
    await result.current.archiveProject({ id: "p1", archived: false });

    expect(toast.success).toHaveBeenCalledWith("Project restored");
  });

  it("toasts the error and rejects when the mutation fails", async () => {
    vi.mocked(apiProjects.updateProject).mockRejectedValue(
      new Error("Project not found"),
    );

    const { result } = renderHook(() => useArchiveProject(), { wrapper });

    await expect(
      result.current.archiveProject({ id: "missing", archived: true }),
    ).rejects.toThrow("Project not found");
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Project not found"),
    );
  });
});
