import React from "react";
import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useLinkProjectToGc } from "../../src/hooks/useLinkProjectToGc";
import * as apiProjects from "../../src/services/apiProjects";
import type { Project } from "../../src/interfaces/project";

vi.mock("react-hot-toast");
vi.mock("../../src/services/apiProjects");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const linkedProject: Project = {
  id: "project-1",
  ownerCompanyId: "company-1",
  name: "Downtown Highrise",
  gcCompanyId: "gc-1",
  gcNameCustom: "Big GC",
  gcContactEmail: null,
  status: "active",
  archivedAt: null,
  createdAt: "2026-09-09T00:00:00.000Z",
};

describe("useLinkProjectToGc", () => {
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

  afterEach(() => {
    onlineManager.setOnline(true);
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("initializes with nothing in flight", () => {
    const { result } = renderHook(() => useLinkProjectToGc(), { wrapper });
    expect(result.current.isLinking).toBe(false);
    expect(result.current.isUnlinking).toBe(false);
  });

  describe("linkProject", () => {
    it("calls apiProjects.linkProjectToGc with the session token, id and code", async () => {
      vi.mocked(apiProjects.linkProjectToGc).mockResolvedValue(linkedProject);

      const { result } = renderHook(() => useLinkProjectToGc(), { wrapper });
      await expect(
        result.current.linkProject({ id: "project-1", joinCode: "K7M2Q9XB" }),
      ).resolves.toEqual(linkedProject);

      expect(apiProjects.linkProjectToGc).toHaveBeenCalledWith(
        "token-123",
        "project-1",
        "K7M2Q9XB",
      );
    });

    it("invalidates every cached projects list and toasts the GC's name on success", async () => {
      vi.mocked(apiProjects.linkProjectToGc).mockResolvedValue(linkedProject);
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useLinkProjectToGc(), { wrapper });
      await result.current.linkProject({
        id: "project-1",
        joinCode: "K7M2Q9XB",
      });

      await waitFor(() =>
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["projects"] }),
      );
      expect(toast.success).toHaveBeenCalledWith("Linked to Big GC");
    });

    it("runs immediately even when TanStack Query's onlineManager reports offline", async () => {
      // Without networkMode: "always" the mutation would sit paused instead of
      // failing fast through fetchWithTimeout.
      onlineManager.setOnline(false);
      vi.mocked(apiProjects.linkProjectToGc).mockResolvedValue(linkedProject);

      const { result } = renderHook(() => useLinkProjectToGc(), { wrapper });
      await result.current.linkProject({
        id: "project-1",
        joinCode: "K7M2Q9XB",
      });

      expect(apiProjects.linkProjectToGc).toHaveBeenCalled();
    });

    it("toasts the server message and rejects when linking fails", async () => {
      vi.mocked(apiProjects.linkProjectToGc).mockRejectedValue(
        new Error("No general contractor matches that join code"),
      );

      const { result } = renderHook(() => useLinkProjectToGc(), { wrapper });

      await expect(
        result.current.linkProject({ id: "project-1", joinCode: "NOPE" }),
      ).rejects.toThrow("No general contractor matches that join code");
      expect(toast.error).toHaveBeenCalledWith(
        "No general contractor matches that join code",
      );
      expect(toast.success).not.toHaveBeenCalled();
    });
  });

  describe("unlinkProject", () => {
    it("calls apiProjects.unlinkProjectFromGc with the session token and id", async () => {
      vi.mocked(apiProjects.unlinkProjectFromGc).mockResolvedValue({
        ...linkedProject,
        gcCompanyId: null,
      });

      const { result } = renderHook(() => useLinkProjectToGc(), { wrapper });
      await result.current.unlinkProject("project-1");

      expect(apiProjects.unlinkProjectFromGc).toHaveBeenCalledWith(
        "token-123",
        "project-1",
      );
    });

    it("invalidates the projects lists and toasts on success", async () => {
      vi.mocked(apiProjects.unlinkProjectFromGc).mockResolvedValue({
        ...linkedProject,
        gcCompanyId: null,
      });
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useLinkProjectToGc(), { wrapper });
      await result.current.unlinkProject("project-1");

      await waitFor(() =>
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["projects"] }),
      );
      expect(toast.success).toHaveBeenCalledWith(
        "Unlinked from the general contractor",
      );
    });

    it("toasts the server message and rejects when unlinking fails", async () => {
      vi.mocked(apiProjects.unlinkProjectFromGc).mockRejectedValue(
        new Error("Project not found"),
      );

      const { result } = renderHook(() => useLinkProjectToGc(), { wrapper });

      await expect(result.current.unlinkProject("project-1")).rejects.toThrow(
        "Project not found",
      );
      expect(toast.error).toHaveBeenCalledWith("Project not found");
    });
  });
});
