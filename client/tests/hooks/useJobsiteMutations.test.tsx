import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useCreateJobsite } from "../../src/hooks/useCreateJobsite";
import { useUpdateJobsite } from "../../src/hooks/useUpdateJobsite";
import { useInviteSubcontractor } from "../../src/hooks/useInviteSubcontractor";
import { useRemoveSubcontractor } from "../../src/hooks/useRemoveSubcontractor";
import { JOBSITES_QUERY_KEY } from "../../src/hooks/useJobsites";
import * as apiJobsites from "../../src/services/apiJobsites";

vi.mock("react-hot-toast");
vi.mock("../../src/services/apiJobsites");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("jobsite mutation hooks", () => {
  let queryClient: QueryClient;
  let invalidateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ session: { access_token: "token-123" } });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe("useCreateJobsite", () => {
    it("creates, refetches the list, and toasts success", async () => {
      vi.mocked(apiJobsites.createJobsite).mockResolvedValue({
        id: "j1",
        name: "Riverside",
      } as never);

      const { result } = renderHook(() => useCreateJobsite(), { wrapper });
      expect(result.current.isCreating).toBe(false);
      await result.current.createJobsite({ name: "Riverside" });

      expect(apiJobsites.createJobsite).toHaveBeenCalledWith("token-123", {
        name: "Riverside",
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: JOBSITES_QUERY_KEY,
      });
      expect(toast.success).toHaveBeenCalledWith("Created Riverside");
    });

    it("toasts the server message and rejects on failure", async () => {
      vi.mocked(apiJobsites.createJobsite).mockRejectedValue(
        new Error("Nope"),
      );

      const { result } = renderHook(() => useCreateJobsite(), { wrapper });

      await expect(
        result.current.createJobsite({ name: "x" }),
      ).rejects.toThrow("Nope");
      expect(toast.error).toHaveBeenCalledWith("Nope");
      expect(invalidateSpy).not.toHaveBeenCalled();
    });
  });

  describe("useUpdateJobsite", () => {
    it("patches, refetches the list, and toasts success", async () => {
      vi.mocked(apiJobsites.updateJobsite).mockResolvedValue({} as never);

      const { result } = renderHook(() => useUpdateJobsite(), { wrapper });
      expect(result.current.isUpdating).toBe(false);
      await result.current.updateJobsite({ id: "j1", patch: { name: "New" } });

      expect(apiJobsites.updateJobsite).toHaveBeenCalledWith(
        "token-123",
        "j1",
        { name: "New" },
      );
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: JOBSITES_QUERY_KEY,
      });
      expect(toast.success).toHaveBeenCalledWith("Job site updated");
    });

    it("toasts the server message and rejects on failure", async () => {
      vi.mocked(apiJobsites.updateJobsite).mockRejectedValue(new Error("Nope"));

      const { result } = renderHook(() => useUpdateJobsite(), { wrapper });

      await expect(
        result.current.updateJobsite({ id: "j1", patch: {} }),
      ).rejects.toThrow("Nope");
      expect(toast.error).toHaveBeenCalledWith("Nope");
    });
  });

  describe("useInviteSubcontractor", () => {
    it("invites, refetches the list, and toasts the address", async () => {
      vi.mocked(apiJobsites.inviteSubcontractor).mockResolvedValue({
        email: "a@b.com",
      });

      const { result } = renderHook(() => useInviteSubcontractor(), {
        wrapper,
      });
      expect(result.current.isInviting).toBe(false);
      await result.current.inviteSubcontractor({
        jobsiteId: "j1",
        email: "a@b.com",
      });

      expect(apiJobsites.inviteSubcontractor).toHaveBeenCalledWith(
        "token-123",
        "j1",
        "a@b.com",
      );
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: JOBSITES_QUERY_KEY,
      });
      expect(toast.success).toHaveBeenCalledWith("Invite sent to a@b.com");
    });

    it("toasts the server message and rejects on failure", async () => {
      vi.mocked(apiJobsites.inviteSubcontractor).mockRejectedValue(
        new Error("Already on this job site"),
      );

      const { result } = renderHook(() => useInviteSubcontractor(), {
        wrapper,
      });

      await expect(
        result.current.inviteSubcontractor({ jobsiteId: "j1", email: "a@b.com" }),
      ).rejects.toThrow("Already on this job site");
      expect(toast.error).toHaveBeenCalledWith("Already on this job site");
    });
  });

  describe("useRemoveSubcontractor", () => {
    it("removes, refetches the list, and toasts success", async () => {
      vi.mocked(apiJobsites.removeSubcontractor).mockResolvedValue(undefined);

      const { result } = renderHook(() => useRemoveSubcontractor(), {
        wrapper,
      });
      expect(result.current.isRemoving).toBe(false);
      await result.current.removeSubcontractor({ jobsiteId: "j1", subId: "s1" });

      expect(apiJobsites.removeSubcontractor).toHaveBeenCalledWith(
        "token-123",
        "j1",
        "s1",
      );
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: JOBSITES_QUERY_KEY,
      });
      expect(toast.success).toHaveBeenCalledWith("Subcontractor removed");
    });

    it("toasts the server message and rejects on failure", async () => {
      vi.mocked(apiJobsites.removeSubcontractor).mockRejectedValue(
        new Error("Nope"),
      );

      const { result } = renderHook(() => useRemoveSubcontractor(), {
        wrapper,
      });

      await expect(
        result.current.removeSubcontractor({ jobsiteId: "j1", subId: "s1" }),
      ).rejects.toThrow("Nope");
      expect(toast.error).toHaveBeenCalledWith("Nope");
    });
  });
});
