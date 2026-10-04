import React from "react";
import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

import { useProjects } from "../../src/hooks/useProjects";
import * as apiProjects from "../../src/services/apiProjects";
import { tailgateDb } from "../../src/utils/db/tailgateDb";

vi.mock("../../src/services/apiProjects");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const project = {
  id: "project-1",
  ownerCompanyId: "company-1",
  name: "Downtown Highrise",
  gcCompanyId: null,
  gcNameCustom: "Acme GC",
  status: "active" as const,
  archivedAt: null,
  createdAt: "2026-09-09T00:00:00.000Z",
};

describe("useProjects", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ session: { access_token: "token-123" } });
  });

  afterEach(async () => {
    await tailgateDb.projectsCache.clear();
    onlineManager.setOnline(true);
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("fetches live projects with the session token and exposes them", async () => {
    vi.mocked(apiProjects.listProjects).mockResolvedValue([project]);

    const { result } = renderHook(() => useProjects(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(apiProjects.listProjects).toHaveBeenCalledWith("token-123", {
      includeArchived: false,
    });
    expect(result.current.projects).toEqual([project]);
    expect(result.current.isError).toBe(false);
  });

  it("passes includeArchived through when asked to show archived projects", async () => {
    vi.mocked(apiProjects.listProjects).mockResolvedValue([project]);

    const { result } = renderHook(() => useProjects(true), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(apiProjects.listProjects).toHaveBeenCalledWith("token-123", {
      includeArchived: true,
    });
  });

  it("defaults projects to an empty array and reports query errors when nothing is cached", async () => {
    vi.mocked(apiProjects.listProjects).mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useProjects(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.projects).toEqual([]);
  });

  it("mirrors a successful fetch into the offline projects cache", async () => {
    vi.mocked(apiProjects.listProjects).mockResolvedValue([project]);

    const { result } = renderHook(() => useProjects(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(await tailgateDb.projectsCache.get("project-1")).toEqual(project);
  });

  it("falls back to the cached projects when the fetch fails but a cache exists", async () => {
    await tailgateDb.projectsCache.put(project);
    vi.mocked(apiProjects.listProjects).mockRejectedValue(
      new Error("Failed to fetch"),
    );

    const { result } = renderHook(() => useProjects(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isError).toBe(false);
    expect(result.current.projects).toEqual([project]);
  });

  it("runs queryFn immediately even when TanStack Query's onlineManager reports offline", async () => {
    // Without networkMode: "always", the default networkMode: "online" would
    // pause this ENTIRE queryFn — including its own try/catch fallback to
    // the offline cache — until onlineManager sees an `online` event.
    onlineManager.setOnline(false);
    await tailgateDb.projectsCache.put(project);
    vi.mocked(apiProjects.listProjects).mockRejectedValue(
      new Error("Failed to fetch"),
    );

    const { result } = renderHook(() => useProjects(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.projects).toEqual([project]);
  });

  it("stays disabled and does not fetch when there is no session", () => {
    mockUseAuth.mockReturnValue({ session: null });

    const { result } = renderHook(() => useProjects(), { wrapper });

    expect(apiProjects.listProjects).not.toHaveBeenCalled();
    expect(result.current.projects).toEqual([]);
  });
});
