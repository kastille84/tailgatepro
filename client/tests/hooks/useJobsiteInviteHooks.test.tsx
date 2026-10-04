import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useJobsiteInvitePreview } from "../../src/hooks/useJobsiteInvitePreview";
import { useAcceptJobsiteInvite } from "../../src/hooks/useAcceptJobsiteInvite";
import { PROJECTS_QUERY_KEY } from "../../src/utils/optimisticProjects";
import * as apiJobsites from "../../src/services/apiJobsites";

vi.mock("react-hot-toast");
vi.mock("../../src/services/apiJobsites");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const preview = {
  gcCompanyName: "Turner",
  jobsiteName: "Riverside",
  email: "a@b.com",
};

describe("jobsite invite hooks", () => {
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

  describe("useJobsiteInvitePreview", () => {
    it("fetches the preview for the token", async () => {
      vi.mocked(apiJobsites.getJobsiteInvitePreview).mockResolvedValue(preview);

      const { result } = renderHook(() => useJobsiteInvitePreview("tok"), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(apiJobsites.getJobsiteInvitePreview).toHaveBeenCalledWith("tok");
      expect(result.current.preview).toEqual(preview);
      expect(result.current.isError).toBe(false);
    });

    it("does not fetch without a token", () => {
      const { result } = renderHook(() => useJobsiteInvitePreview(undefined), { wrapper });

      expect(result.current.preview).toBeNull();
      expect(apiJobsites.getJobsiteInvitePreview).not.toHaveBeenCalled();
    });

    it("surfaces an invalid token as an error without retrying", async () => {
      vi.mocked(apiJobsites.getJobsiteInvitePreview).mockRejectedValue(new Error("bad"));

      const { result } = renderHook(() => useJobsiteInvitePreview("tok"), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(apiJobsites.getJobsiteInvitePreview).toHaveBeenCalledTimes(1);
    });
  });

  describe("useAcceptJobsiteInvite", () => {
    it("accepts with the session token, refetches projects, and toasts", async () => {
      const invalidate = vi.spyOn(queryClient, "invalidateQueries");
      vi.mocked(apiJobsites.acceptJobsiteInvite).mockResolvedValue({
        name: "Riverside",
      } as never);

      const { result } = renderHook(() => useAcceptJobsiteInvite(), { wrapper });
      expect(result.current.isAccepting).toBe(false);
      await result.current.acceptInvite("tok");

      expect(apiJobsites.acceptJobsiteInvite).toHaveBeenCalledWith("token-123", "tok");
      expect(invalidate).toHaveBeenCalledWith({ queryKey: PROJECTS_QUERY_KEY });
      expect(toast.success).toHaveBeenCalledWith("You've joined Riverside");
    });

    it("toasts the server message and rejects on failure", async () => {
      vi.mocked(apiJobsites.acceptJobsiteInvite).mockRejectedValue(
        new Error("This invite was sent to a different email address"),
      );

      const { result } = renderHook(() => useAcceptJobsiteInvite(), { wrapper });

      await expect(result.current.acceptInvite("tok")).rejects.toThrow(
        "different email",
      );
      expect(toast.error).toHaveBeenCalledWith(
        "This invite was sent to a different email address",
      );
    });
  });
});
