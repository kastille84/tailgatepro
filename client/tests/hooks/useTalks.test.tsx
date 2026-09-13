import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useTalks } from "../../src/hooks/useTalks";
import * as apiTalks from "../../src/services/apiTalks";

vi.mock("../../src/services/apiTalks");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const talk = {
  id: "talk-1",
  slug: "eye-protection",
  title: "Eye Protection on the Jobsite",
  tradeTag: "General Construction",
  tradeTags: ["General Construction", "Welding"],
  content: "# Eye Protection on the Jobsite\n",
  structured: { summary: "...", talking_points: [] },
  attribution: { source: "NIOSH" },
  isGlobal: true,
  companyId: null,
  createdAt: "2026-09-09T00:00:00.000Z",
};

describe("useTalks", () => {
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

  it("fetches the talk library with the session token and exposes it", async () => {
    vi.mocked(apiTalks.listTalks).mockResolvedValue([talk]);

    const { result } = renderHook(() => useTalks(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(apiTalks.listTalks).toHaveBeenCalledWith("token-123");
    expect(result.current.talks).toEqual([talk]);
    expect(result.current.isError).toBe(false);
  });

  it("defaults talks to an empty array and reports query errors", async () => {
    vi.mocked(apiTalks.listTalks).mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useTalks(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.talks).toEqual([]);
  });

  it("stays disabled and does not fetch when there is no session", () => {
    mockUseAuth.mockReturnValue({ session: null });

    const { result } = renderHook(() => useTalks(), { wrapper });

    expect(apiTalks.listTalks).not.toHaveBeenCalled();
    expect(result.current.talks).toEqual([]);
  });

  it("derives a deduped, alphabetically sorted tradeOptions list from every talk's tradeTags", async () => {
    vi.mocked(apiTalks.listTalks).mockResolvedValue([
      { ...talk, id: "t1", tradeTags: ["Welding", "General Construction"] },
      { ...talk, id: "t2", tradeTags: ["Electrical", "Welding"] },
    ]);

    const { result } = renderHook(() => useTalks(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.tradeOptions).toEqual([
      { value: "Electrical", label: "Electrical" },
      { value: "General Construction", label: "General Construction" },
      { value: "Welding", label: "Welding" },
    ]);
  });

  it("defaults tradeOptions to an empty array when there is no session", () => {
    mockUseAuth.mockReturnValue({ session: null });

    const { result } = renderHook(() => useTalks(), { wrapper });

    expect(result.current.tradeOptions).toEqual([]);
  });
});
