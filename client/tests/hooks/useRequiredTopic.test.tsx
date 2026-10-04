import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useRequiredTopic } from "../../src/hooks/useRequiredTopic";
import * as apiProjects from "../../src/services/apiProjects";
import type { RequiredTopic } from "../../src/interfaces/requiredTopic";

vi.mock("../../src/services/apiProjects");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const requiredTopic: RequiredTopic = {
  talkId: "talk-1",
  talkTitle: "Fall Protection",
  pushedAt: "2026-09-01T00:00:00.000Z",
};

describe("useRequiredTopic", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ session: { access_token: "token-123" } });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("fetches the project's required topic when a projectId is given", async () => {
    vi.mocked(apiProjects.getRequiredTopic).mockResolvedValue(requiredTopic);

    const { result } = renderHook(() => useRequiredTopic("project-1"), { wrapper });

    await waitFor(() => expect(result.current.requiredTopic).toEqual(requiredTopic));
    expect(apiProjects.getRequiredTopic).toHaveBeenCalledWith("token-123", "project-1");
  });

  it("defaults to null while loading, on error, or with no projectId", async () => {
    vi.mocked(apiProjects.getRequiredTopic).mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useRequiredTopic("project-1"), { wrapper });
    expect(result.current.requiredTopic).toBeNull();

    await waitFor(() => expect(apiProjects.getRequiredTopic).toHaveBeenCalled());
  });

  it("is disabled (no fetch) without a session", () => {
    mockUseAuth.mockReturnValue({ session: null });

    const { result } = renderHook(() => useRequiredTopic("project-1"), { wrapper });

    expect(apiProjects.getRequiredTopic).not.toHaveBeenCalled();
    expect(result.current.requiredTopic).toBeNull();
  });

  it("is disabled (no fetch) without a projectId", () => {
    const { result } = renderHook(() => useRequiredTopic(undefined), { wrapper });

    expect(apiProjects.getRequiredTopic).not.toHaveBeenCalled();
    expect(result.current.requiredTopic).toBeNull();
  });
});
