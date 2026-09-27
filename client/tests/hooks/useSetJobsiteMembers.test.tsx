import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useSetJobsiteMembers } from "../../src/hooks/useSetJobsiteMembers";
import * as apiJobsites from "../../src/services/apiJobsites";
import { PlanLimitError } from "../../src/utils/PlanLimitError";

vi.mock("react-hot-toast");
vi.mock("../../src/services/apiJobsites");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("useSetJobsiteMembers", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ session: { access_token: "token-123" } });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("initializes with nothing in flight", () => {
    const { result } = renderHook(() => useSetJobsiteMembers(), { wrapper });
    expect(result.current.isSaving).toBe(false);
    expect(result.current.planLimitError).toBeNull();
  });

  it("calls apiJobsites.setJobsiteMembers with the session token, caches the result, and toasts success", async () => {
    const data = { members: [{ userId: "u-1", name: "Ann", assigned: true }] };
    vi.mocked(apiJobsites.setJobsiteMembers).mockResolvedValue(data);

    const { result } = renderHook(() => useSetJobsiteMembers(), { wrapper });
    await result.current.setJobsiteMembers({ jobsiteId: "j1", userIds: ["u-1"] });

    expect(apiJobsites.setJobsiteMembers).toHaveBeenCalledWith("token-123", "j1", ["u-1"]);
    expect(toast.success).toHaveBeenCalledWith("Jobsite team updated");
    expect(queryClient.getQueryData(["jobsiteMembers", "j1"])).toEqual(data);
  });

  it("toasts the server message and rejects when saving fails", async () => {
    vi.mocked(apiJobsites.setJobsiteMembers).mockRejectedValue(new Error("nope"));

    const { result } = renderHook(() => useSetJobsiteMembers(), { wrapper });

    await expect(
      result.current.setJobsiteMembers({ jobsiteId: "j1", userIds: [] }),
    ).rejects.toThrow("nope");
    expect(toast.error).toHaveBeenCalledWith("nope");
  });

  it("exposes a plan-limit rejection as planLimitError without toasting", async () => {
    vi.mocked(apiJobsites.setJobsiteMembers).mockRejectedValue(
      new PlanLimitError("Superintendent roles are part of GC Portfolio.", null),
    );

    const { result } = renderHook(() => useSetJobsiteMembers(), { wrapper });
    expect(result.current.planLimitError).toBeNull();

    await act(async () => {
      await result.current
        .setJobsiteMembers({ jobsiteId: "j1", userIds: [] })
        .catch(() => undefined);
    });

    await waitFor(() =>
      expect(result.current.planLimitError?.message).toBe(
        "Superintendent roles are part of GC Portfolio.",
      ),
    );
    expect(toast.error).not.toHaveBeenCalled();
  });
});
