import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useInHouseCrewActions, useInHouseCrews } from "../../src/hooks/useInHouseCrews";
import * as api from "../../src/services/apiInHouseCrews";
import { PlanLimitError } from "../../src/utils/PlanLimitError";

vi.mock("react-hot-toast");
vi.mock("../../src/services/apiInHouseCrews");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const crew = { id: "c1", name: "Hyperion - Framing", archivedAt: null, createdAt: "2026-01-01" };

describe("useInHouseCrews", () => {
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

  describe("useInHouseCrews", () => {
    it("loads the crews with the session token", async () => {
      vi.mocked(api.listInHouseCrews).mockResolvedValue([crew]);

      const { result } = renderHook(() => useInHouseCrews(), { wrapper });
      expect(result.current.crews).toEqual([]);
      expect(result.current.isLoaded).toBe(false);

      await waitFor(() => expect(result.current.isLoaded).toBe(true));
      expect(api.listInHouseCrews).toHaveBeenCalledWith("token-123");
      expect(result.current.crews).toEqual([crew]);
      expect(result.current.isError).toBe(false);
    });

    it("reports an error", async () => {
      vi.mocked(api.listInHouseCrews).mockRejectedValue(new Error("boom"));

      const { result } = renderHook(() => useInHouseCrews(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    it("does not fetch without a session or when disabled", () => {
      mockUseAuth.mockReturnValue({ session: null });
      renderHook(() => useInHouseCrews(), { wrapper });

      mockUseAuth.mockReturnValue({ session: { access_token: "token-123" } });
      renderHook(() => useInHouseCrews({ enabled: false }), { wrapper });

      expect(api.listInHouseCrews).not.toHaveBeenCalled();
    });
  });

  describe("useInHouseCrewActions", () => {
    it("creates a crew, refreshes crews, sites and the dashboard, and toasts", async () => {
      vi.mocked(api.createInHouseCrew).mockResolvedValue(crew);
      const invalidate = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useInHouseCrewActions(), { wrapper });
      await act(async () => {
        await result.current.createCrew({ name: "Hyperion - Framing" });
      });

      expect(api.createInHouseCrew).toHaveBeenCalledWith("token-123", {
        name: "Hyperion - Framing",
      });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ["inHouseCrews"] });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ["jobsites"] });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ["gcOverview"] });
      expect(toast.success).toHaveBeenCalledWith("Added Hyperion - Framing");
      await waitFor(() => expect(result.current.isCreating).toBe(false));
    });

    it("exposes a create plan-limit rejection without toasting", async () => {
      vi.mocked(api.createInHouseCrew).mockRejectedValue(new PlanLimitError("Upgrade", 1));

      const { result } = renderHook(() => useInHouseCrewActions(), { wrapper });
      expect(result.current.createPlanLimitError).toBeNull();
      await act(async () => {
        await result.current.createCrew({ name: "x" }).catch(() => undefined);
      });

      await waitFor(() => expect(result.current.createPlanLimitError).toBeInstanceOf(PlanLimitError));
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("toasts any other failure", async () => {
      vi.mocked(api.createInHouseCrew).mockRejectedValue(
        new Error("You already have a crew with that name"),
      );

      const { result } = renderHook(() => useInHouseCrewActions(), { wrapper });
      await act(async () => {
        await result.current.createCrew({ name: "x" }).catch(() => undefined);
      });

      expect(toast.error).toHaveBeenCalledWith("You already have a crew with that name");
      expect(result.current.createPlanLimitError).toBeNull();
    });

    it("updates a crew and refreshes", async () => {
      vi.mocked(api.updateInHouseCrew).mockResolvedValue(crew);
      const invalidate = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useInHouseCrewActions(), { wrapper });
      await act(async () => {
        await result.current.updateCrew({ id: "c1", patch: { archived: true } });
      });

      expect(api.updateInHouseCrew).toHaveBeenCalledWith("token-123", "c1", { archived: true });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ["inHouseCrews"] });
      await waitFor(() => expect(result.current.isUpdating).toBe(false));
    });

    it("deletes a crew, refreshes and toasts", async () => {
      vi.mocked(api.deleteInHouseCrew).mockResolvedValue(undefined);

      const { result } = renderHook(() => useInHouseCrewActions(), { wrapper });
      await act(async () => {
        await result.current.deleteCrew("c1");
      });

      expect(api.deleteInHouseCrew).toHaveBeenCalledWith("token-123", "c1");
      expect(toast.success).toHaveBeenCalledWith("Crew deleted");
      await waitFor(() => expect(result.current.isDeleting).toBe(false));
    });

    it("invites a crew member and toasts, exposing a plan-limit rejection inline", async () => {
      vi.mocked(api.inviteCrewMember).mockResolvedValueOnce({
        email: "f@example.com",
        role: "foreman",
      });

      const { result } = renderHook(() => useInHouseCrewActions(), { wrapper });
      await act(async () => {
        await result.current.inviteCrewMember({
          crewId: "c1",
          email: "f@example.com",
          role: "foreman",
        });
      });
      expect(api.inviteCrewMember).toHaveBeenCalledWith("token-123", {
        crewId: "c1",
        email: "f@example.com",
        role: "foreman",
      });
      expect(toast.success).toHaveBeenCalledWith("Invite sent to f@example.com");

      vi.mocked(api.inviteCrewMember).mockRejectedValueOnce(new PlanLimitError("Seat cap", 1));
      await act(async () => {
        await result.current
          .inviteCrewMember({ crewId: "c1", email: "g@example.com", role: "admin" })
          .catch(() => undefined);
      });
      await waitFor(() => expect(result.current.invitePlanLimitError).toBeInstanceOf(PlanLimitError));
      expect(toast.error).not.toHaveBeenCalled();
      await waitFor(() => expect(result.current.isInviting).toBe(false));
    });

    it("attaches a crew to a job site and toasts", async () => {
      vi.mocked(api.attachCrewToJobsite).mockResolvedValue(undefined);

      const { result } = renderHook(() => useInHouseCrewActions(), { wrapper });
      await act(async () => {
        await result.current.attachCrew({ jobsiteId: "j1", crewId: "c1" });
      });

      expect(api.attachCrewToJobsite).toHaveBeenCalledWith("token-123", "j1", "c1");
      expect(toast.success).toHaveBeenCalledWith("Crew added to the job site");
      await waitFor(() => expect(result.current.isAttaching).toBe(false));
    });
  });
});
