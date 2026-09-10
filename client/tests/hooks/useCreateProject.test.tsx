import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useCreateProject } from "../../src/hooks/useCreateProject";
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
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("initializes with isCreating false", () => {
    const { result } = renderHook(() => useCreateProject(), { wrapper });
    expect(result.current.isCreating).toBe(false);
  });

  it("calls createProject with the token and input, then invalidates the projects query", async () => {
    vi.mocked(apiProjects.createProject).mockResolvedValue(project);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateProject(), { wrapper });

    await result.current.createProject({ name: "Site", gcNameCustom: "GC" });

    expect(apiProjects.createProject).toHaveBeenCalledWith("token-123", {
      name: "Site",
      gcNameCustom: "GC",
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["projects"] });
  });

  it("toasts the error and rejects when the mutation fails", async () => {
    vi.mocked(apiProjects.createProject).mockRejectedValue(
      new Error("This project already exists"),
    );

    const { result } = renderHook(() => useCreateProject(), { wrapper });

    await expect(
      result.current.createProject({ name: "Site", gcNameCustom: "GC" }),
    ).rejects.toThrow("This project already exists");

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("This project already exists"),
    );
  });
});
