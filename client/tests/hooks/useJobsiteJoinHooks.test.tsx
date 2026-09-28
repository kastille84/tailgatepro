import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useJobsiteJoinLink } from "../../src/hooks/useJobsiteJoinLink";
import { useJoinLinkPreview } from "../../src/hooks/useJoinLinkPreview";
import { useAcceptJoinLink } from "../../src/hooks/useAcceptJoinLink";
import { PROJECTS_QUERY_KEY } from "../../src/utils/optimisticProjects";
import * as apiJobsites from "../../src/services/apiJobsites";

vi.mock("react-hot-toast");
vi.mock("../../src/services/apiJobsites");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const preview = { gcCompanyName: "Turner", jobsiteName: "Riverside" };

describe("jobsite QR/join-link hooks (Phase 9e)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ session: { access_token: "token-123" } });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe("useJobsiteJoinLink", () => {
    it("fetches the join link with the session token for the given jobsite", async () => {
      vi.mocked(apiJobsites.getJobsiteJoinLink).mockResolvedValue({
        joinUrl: "https://app.example.com/jobsite-join/tok",
      });

      const { result } = renderHook(() => useJobsiteJoinLink("j1"), { wrapper });

      await waitFor(() =>
        expect(result.current.joinUrl).toBe("https://app.example.com/jobsite-join/tok"),
      );
      expect(apiJobsites.getJobsiteJoinLink).toHaveBeenCalledWith("token-123", "j1");
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isError).toBe(false);
    });

    it("does not fetch without a jobsite id", () => {
      const { result } = renderHook(() => useJobsiteJoinLink(undefined), { wrapper });

      expect(result.current.joinUrl).toBeNull();
      expect(apiJobsites.getJobsiteJoinLink).not.toHaveBeenCalled();
    });

    it("does not fetch without a session", () => {
      mockUseAuth.mockReturnValue({ session: null });

      const { result } = renderHook(() => useJobsiteJoinLink("j1"), { wrapper });

      expect(apiJobsites.getJobsiteJoinLink).not.toHaveBeenCalled();
      expect(result.current.joinUrl).toBeNull();
    });

    it("reports isError when the fetch fails", async () => {
      vi.mocked(apiJobsites.getJobsiteJoinLink).mockRejectedValue(new Error("boom"));

      const { result } = renderHook(() => useJobsiteJoinLink("j1"), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.joinUrl).toBeNull();
    });
  });

  describe("useJoinLinkPreview", () => {
    it("fetches the preview for the token", async () => {
      vi.mocked(apiJobsites.getJobsiteJoinPreview).mockResolvedValue(preview);

      const { result } = renderHook(() => useJoinLinkPreview("tok"), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(apiJobsites.getJobsiteJoinPreview).toHaveBeenCalledWith("tok");
      expect(result.current.preview).toEqual(preview);
      expect(result.current.isError).toBe(false);
    });

    it("does not fetch without a token", () => {
      const { result } = renderHook(() => useJoinLinkPreview(undefined), { wrapper });

      expect(result.current.preview).toBeNull();
      expect(apiJobsites.getJobsiteJoinPreview).not.toHaveBeenCalled();
    });

    it("surfaces an invalid token as an error without retrying", async () => {
      vi.mocked(apiJobsites.getJobsiteJoinPreview).mockRejectedValue(new Error("bad"));

      const { result } = renderHook(() => useJoinLinkPreview("tok"), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(apiJobsites.getJobsiteJoinPreview).toHaveBeenCalledTimes(1);
    });
  });

  describe("useAcceptJoinLink", () => {
    it("accepts with the session token, refetches projects, and toasts the joined project's name", async () => {
      const invalidate = vi.spyOn(queryClient, "invalidateQueries");
      vi.mocked(apiJobsites.acceptJobsiteJoinLink).mockResolvedValue({
        id: "p1",
        name: "Riverside",
        alreadyMember: false,
      } as never);

      const { result } = renderHook(() => useAcceptJoinLink(), { wrapper });
      expect(result.current.isAccepting).toBe(false);
      await result.current.acceptJoinLink("tok");

      expect(apiJobsites.acceptJobsiteJoinLink).toHaveBeenCalledWith("token-123", "tok");
      expect(invalidate).toHaveBeenCalledWith({ queryKey: PROJECTS_QUERY_KEY });
      expect(toast.success).toHaveBeenCalledWith("You've joined Riverside");
    });

    it("toasts a friendlier message on a repeat scan instead of the joined-name toast", async () => {
      vi.mocked(apiJobsites.acceptJobsiteJoinLink).mockResolvedValue({
        alreadyMember: true,
      });

      const { result } = renderHook(() => useAcceptJoinLink(), { wrapper });
      await result.current.acceptJoinLink("tok");

      expect(toast.success).toHaveBeenCalledWith("You're already on this job site");
    });

    it("toasts the server message and rejects on failure", async () => {
      vi.mocked(apiJobsites.acceptJobsiteJoinLink).mockRejectedValue(new Error("boom"));

      const { result } = renderHook(() => useAcceptJoinLink(), { wrapper });

      await expect(result.current.acceptJoinLink("tok")).rejects.toThrow("boom");
      expect(toast.error).toHaveBeenCalledWith("boom");
    });
  });
});
