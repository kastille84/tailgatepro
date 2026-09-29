import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useSetMyCadence } from "../../src/hooks/useSetMyCadence";
import { JOBSITE_MEMBERSHIPS_QUERY_KEY } from "../../src/hooks/useJobsiteMemberships";
import * as apiJobsites from "../../src/services/apiJobsites";

vi.mock("react-hot-toast");
vi.mock("../../src/services/apiJobsites");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("useSetMyCadence", () => {
  let queryClient: QueryClient;
  let invalidateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ session: { access_token: "token-123" } });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("saves the cadence, refetches the memberships and toasts success", async () => {
    vi.mocked(apiJobsites.setMyJobsiteCadence).mockResolvedValue({} as never);

    const { result } = renderHook(() => useSetMyCadence(), { wrapper });
    expect(result.current.isSaving).toBe(false);
    await result.current.setMyCadence({ jobsiteId: "j1", cadence: "daily" });

    expect(apiJobsites.setMyJobsiteCadence).toHaveBeenCalledWith("token-123", "j1", "daily");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: JOBSITE_MEMBERSHIPS_QUERY_KEY });
    expect(toast.success).toHaveBeenCalledWith("Meeting cadence updated");
  });

  it("toasts the server message and rejects on failure", async () => {
    vi.mocked(apiJobsites.setMyJobsiteCadence).mockRejectedValue(new Error("Too loose"));

    const { result } = renderHook(() => useSetMyCadence(), { wrapper });

    await expect(
      result.current.setMyCadence({ jobsiteId: "j1", cadence: "weekly" }),
    ).rejects.toThrow("Too loose");
    expect(toast.error).toHaveBeenCalledWith("Too loose");
  });
});
