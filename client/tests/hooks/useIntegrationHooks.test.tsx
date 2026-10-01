import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useJobsiteIntegrations } from "../../src/hooks/useJobsiteIntegrations";
import { useConnectIntegration } from "../../src/hooks/useConnectIntegration";
import { useDisconnectIntegration } from "../../src/hooks/useDisconnectIntegration";
import { useRetryPush } from "../../src/hooks/useRetryPush";
import * as api from "../../src/services/apiIntegrations";

vi.mock("react-hot-toast");
vi.mock("../../src/services/apiIntegrations");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("integration hooks", () => {
  let queryClient: QueryClient;
  let invalidateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ session: { access_token: "token-123" } });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe("useJobsiteIntegrations", () => {
    it("loads integrations and pushes", async () => {
      vi.mocked(api.listJobsiteIntegrations).mockResolvedValue({
        sitePro: true,
        integrations: [
          { id: "i1", provider: "procore", externalProjectId: "7", externalFolderId: null, status: "connected", lastError: null },
        ],
        recentPushes: [],
      });
      const { result } = renderHook(() => useJobsiteIntegrations("j1"), { wrapper });

      await waitFor(() => expect(result.current.integrations).toHaveLength(1));
      expect(api.listJobsiteIntegrations).toHaveBeenCalledWith("token-123", "j1");
      expect(result.current.recentPushes).toEqual([]);
    });

    it("defaults to empty lists and reports errors", async () => {
      vi.mocked(api.listJobsiteIntegrations).mockRejectedValue(new Error("boom"));
      const { result } = renderHook(() => useJobsiteIntegrations("j1"), { wrapper });

      expect(result.current.integrations).toEqual([]);
      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    it("does not fetch without a session", () => {
      mockUseAuth.mockReturnValue({ session: null });
      renderHook(() => useJobsiteIntegrations("j1"), { wrapper });
      expect(api.listJobsiteIntegrations).not.toHaveBeenCalled();
    });
  });

  describe("useConnectIntegration", () => {
    const input = {
      jobsiteId: "j1",
      provider: "procore" as const,
      credentials: { clientId: "a" },
      projectId: "7",
    };

    it("connects, refreshes the list and toasts success", async () => {
      vi.mocked(api.connectIntegration).mockResolvedValue({
        id: "i1", provider: "procore", externalProjectId: "7", externalFolderId: null, status: "connected", lastError: null,
      });
      const { result } = renderHook(() => useConnectIntegration(), { wrapper });
      expect(result.current.isConnecting).toBe(false);

      await result.current.connectIntegration(input);

      expect(api.connectIntegration).toHaveBeenCalledWith("token-123", input);
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["jobsiteIntegrations", "j1"] });
      expect(toast.success).toHaveBeenCalledWith("Integration connected");
    });

    it("toasts the provider's rejection and rethrows", async () => {
      vi.mocked(api.connectIntegration).mockRejectedValue(new Error("Procore rejected the request (401)"));
      const { result } = renderHook(() => useConnectIntegration(), { wrapper });

      await expect(result.current.connectIntegration(input)).rejects.toThrow("Procore rejected");
      expect(toast.error).toHaveBeenCalledWith("Procore rejected the request (401)");
    });
  });

  describe("useDisconnectIntegration", () => {
    it("disconnects, refreshes the list and toasts success", async () => {
      vi.mocked(api.disconnectIntegration).mockResolvedValue(undefined);
      const { result } = renderHook(() => useDisconnectIntegration(), { wrapper });
      expect(result.current.isDisconnecting).toBe(false);

      await result.current.disconnectIntegration({ jobsiteId: "j1", provider: "acc" });

      expect(api.disconnectIntegration).toHaveBeenCalledWith("token-123", "j1", "acc");
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["jobsiteIntegrations", "j1"] });
      expect(toast.success).toHaveBeenCalledWith("Integration disconnected");
    });

    it("toasts failures", async () => {
      vi.mocked(api.disconnectIntegration).mockRejectedValue(new Error("nope"));
      const { result } = renderHook(() => useDisconnectIntegration(), { wrapper });

      await expect(
        result.current.disconnectIntegration({ jobsiteId: "j1", provider: "acc" }),
      ).rejects.toThrow("nope");
      expect(toast.error).toHaveBeenCalledWith("nope");
    });
  });

  describe("useRetryPush", () => {
    it("toasts success and refreshes the list when the retry sends", async () => {
      vi.mocked(api.retryIntegrationPush).mockResolvedValue({ status: "sent" });
      const { result } = renderHook(() => useRetryPush(), { wrapper });
      expect(result.current.retryingPushId).toBeNull();

      result.current.retryPush({ pushId: "p1", jobsiteId: "j1" });

      await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Report sent"));
      expect(api.retryIntegrationPush).toHaveBeenCalledWith("token-123", "p1");
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["jobsiteIntegrations", "j1"] });
    });

    it("reports the id while pending", async () => {
      let resolve: (value: { status: "sent" }) => void = () => {};
      vi.mocked(api.retryIntegrationPush).mockReturnValue(
        new Promise((r) => {
          resolve = r;
        }),
      );
      const { result } = renderHook(() => useRetryPush(), { wrapper });

      result.current.retryPush({ pushId: "p1", jobsiteId: "j1" });
      await waitFor(() => expect(result.current.retryingPushId).toBe("p1"));
      resolve({ status: "sent" });
      await waitFor(() => expect(result.current.retryingPushId).toBeNull());
    });

    it("toasts an error when the retry fails again", async () => {
      vi.mocked(api.retryIntegrationPush).mockResolvedValue({ status: "failed" });
      const { result } = renderHook(() => useRetryPush(), { wrapper });

      result.current.retryPush({ pushId: "p1", jobsiteId: "j1" });

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(
          "The report could not be sent. Check the connection and try again.",
        ),
      );
    });

    it("toasts a request error", async () => {
      vi.mocked(api.retryIntegrationPush).mockRejectedValue(new Error("nope"));
      const { result } = renderHook(() => useRetryPush(), { wrapper });

      result.current.retryPush({ pushId: "p1", jobsiteId: "j1" });

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("nope"));
    });
  });
});
