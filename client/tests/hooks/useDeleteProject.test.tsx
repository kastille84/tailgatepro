import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useDeleteProject } from "../../src/hooks/useDeleteProject";
import * as apiProjects from "../../src/services/apiProjects";

vi.mock("react-hot-toast");
vi.mock("../../src/services/apiProjects");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

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
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("initializes with isDeleting false", () => {
    const { result } = renderHook(() => useDeleteProject(), { wrapper });
    expect(result.current.isDeleting).toBe(false);
  });

  it("deletes by id, toasts success, and invalidates the projects query", async () => {
    vi.mocked(apiProjects.deleteProject).mockResolvedValue({ id: "p1" });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteProject(), { wrapper });
    await result.current.deleteProject("p1");

    expect(apiProjects.deleteProject).toHaveBeenCalledWith("token-123", "p1");
    expect(toast.success).toHaveBeenCalledWith("Project deleted");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["projects"] });
  });

  it("toasts the error (e.g. the 409 archive-instead guard) and rejects", async () => {
    vi.mocked(apiProjects.deleteProject).mockRejectedValue(
      new Error(
        "This project has logged safety talks and can't be deleted. Archive it instead.",
      ),
    );

    const { result } = renderHook(() => useDeleteProject(), { wrapper });

    await expect(result.current.deleteProject("p1")).rejects.toThrow(
      "Archive it instead.",
    );
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("Archive it instead."),
      ),
    );
  });
});
