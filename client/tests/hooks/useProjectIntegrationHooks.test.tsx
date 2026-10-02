import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useProjectIntegrations } from "../../src/hooks/useProjectIntegrations";
import { useConnectProjectIntegration } from "../../src/hooks/useConnectProjectIntegration";
import { useDisconnectProjectIntegration } from "../../src/hooks/useDisconnectProjectIntegration";
import { useRetryProjectPush } from "../../src/hooks/useRetryProjectPush";
import * as api from "../../src/services/apiIntegrations";

vi.mock("react-hot-toast");
vi.mock("../../src/services/apiIntegrations");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("project integration hooks", () => {
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

  const key = { queryKey: ["projectIntegrations", "pr1"] };

  describe("useProjectIntegrations", () => {
    it("loads the plan flag, integrations and pushes", async () => {
      vi.mocked(api.listProjectIntegrations).mockResolvedValue({
        enterprise: true,
        integrations: [
          { id: "i1", provider: "jobtread", externalProjectId: "j", externalFolderId: null, status: "connected", lastError: null },
        ],
        recentPushes: [],
      });
      const { result } = renderHook(() => useProjectIntegrations("pr1"), { wrapper });

      await waitFor(() => expect(result.current.integrations).toHaveLength(1));
      expect(api.listProjectIntegrations).toHaveBeenCalledWith("token-123", "pr1");
      expect(result.current.enterprise).toBe(true);
      expect(result.current.recentPushes).toEqual([]);
    });

    it("defaults to empty and not-enterprise, and reports errors", async () => {
      vi.mocked(api.listProjectIntegrations).mockRejectedValue(new Error("boom"));
      const { result } = renderHook(() => useProjectIntegrations("pr1"), { wrapper });

      expect(result.current.integrations).toEqual([]);
      expect(result.current.enterprise).toBe(false);
      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    it("does not fetch without a session", () => {
      mockUseAuth.mockReturnValue({ session: null });
      renderHook(() => useProjectIntegrations("pr1"), { wrapper });
      expect(api.listProjectIntegrations).not.toHaveBeenCalled();
    });
  });

  describe("useConnectProjectIntegration", () => {
    const input = {
      tailgateProjectId: "pr1",
      provider: "jobtread" as const,
      credentials: { grantKey: "gk" },
      projectId: "job-1",
    };

    it("connects, refreshes the list and toasts success", async () => {
      vi.mocked(api.connectProjectIntegration).mockResolvedValue({
        id: "i1", provider: "jobtread", externalProjectId: "job-1", externalFolderId: null, status: "connected", lastError: null,
      });
      const { result } = renderHook(() => useConnectProjectIntegration(), { wrapper });
      expect(result.current.isConnecting).toBe(false);

      await result.current.connectIntegration(input);

      expect(api.connectProjectIntegration).toHaveBeenCalledWith("token-123", input);
      expect(invalidateSpy).toHaveBeenCalledWith(key);
      expect(toast.success).toHaveBeenCalledWith("Integration connected");
    });

    it("toasts the provider rejection and rethrows", async () => {
      vi.mocked(api.connectProjectIntegration).mockRejectedValue(new Error("JobTread rejected the request (401)"));
      const { result } = renderHook(() => useConnectProjectIntegration(), { wrapper });

      await expect(result.current.connectIntegration(input)).rejects.toThrow("JobTread rejected");
      expect(toast.error).toHaveBeenCalledWith("JobTread rejected the request (401)");
    });
  });

  describe("useDisconnectProjectIntegration", () => {
    it("disconnects, refreshes the list and toasts success", async () => {
      vi.mocked(api.disconnectProjectIntegration).mockResolvedValue(undefined);
      const { result } = renderHook(() => useDisconnectProjectIntegration(), { wrapper });
      expect(result.current.isDisconnecting).toBe(false);

      await result.current.disconnectIntegration({ projectId: "pr1", provider: "procore" });

      expect(api.disconnectProjectIntegration).toHaveBeenCalledWith("token-123", "pr1", "procore");
      expect(invalidateSpy).toHaveBeenCalledWith(key);
      expect(toast.success).toHaveBeenCalledWith("Integration disconnected");
    });

    it("toasts failures", async () => {
      vi.mocked(api.disconnectProjectIntegration).mockRejectedValue(new Error("nope"));
      const { result } = renderHook(() => useDisconnectProjectIntegration(), { wrapper });

      await expect(
        result.current.disconnectIntegration({ projectId: "pr1", provider: "procore" }),
      ).rejects.toThrow("nope");
      expect(toast.error).toHaveBeenCalledWith("nope");
    });
  });

  describe("useRetryProjectPush", () => {
    it("toasts success and refreshes the list when the retry sends", async () => {
      vi.mocked(api.retryProjectIntegrationPush).mockResolvedValue({ status: "sent" });
      const { result } = renderHook(() => useRetryProjectPush(), { wrapper });
      expect(result.current.retryingPushId).toBeNull();

      result.current.retryPush({ pushId: "p1", projectId: "pr1" });

      await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Report sent"));
      expect(api.retryProjectIntegrationPush).toHaveBeenCalledWith("token-123", "p1");
      expect(invalidateSpy).toHaveBeenCalledWith(key);
    });

    it("reports the id while pending", async () => {
      let resolve: (value: { status: "sent" }) => void = () => {};
      vi.mocked(api.retryProjectIntegrationPush).mockReturnValue(
        new Promise((r) => {
          resolve = r;
        }),
      );
      const { result } = renderHook(() => useRetryProjectPush(), { wrapper });

      result.current.retryPush({ pushId: "p1", projectId: "pr1" });
      await waitFor(() => expect(result.current.retryingPushId).toBe("p1"));
      resolve({ status: "sent" });
      await waitFor(() => expect(result.current.retryingPushId).toBeNull());
    });

    it("toasts an error when the retry fails again", async () => {
      vi.mocked(api.retryProjectIntegrationPush).mockResolvedValue({ status: "failed" });
      const { result } = renderHook(() => useRetryProjectPush(), { wrapper });

      result.current.retryPush({ pushId: "p1", projectId: "pr1" });

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(
          "The report could not be sent. Check the connection and try again.",
        ),
      );
    });

    it("toasts a request error", async () => {
      vi.mocked(api.retryProjectIntegrationPush).mockRejectedValue(new Error("nope"));
      const { result } = renderHook(() => useRetryProjectPush(), { wrapper });

      result.current.retryPush({ pushId: "p1", projectId: "pr1" });

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("nope"));
    });
  });
});
