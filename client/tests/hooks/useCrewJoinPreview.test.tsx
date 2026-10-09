import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useCrewJoinPreview } from "../../src/hooks/useCrewJoinPreview";
import * as api from "../../src/services/apiInHouseCrews";

vi.mock("../../src/services/apiInHouseCrews");

describe("useCrewJoinPreview", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("loads the public preview for a token", async () => {
    vi.mocked(api.previewCrewJoin).mockResolvedValue({ crewName: "Crew", gcName: "GC" });

    const { result } = renderHook(() => useCrewJoinPreview("tok"), { wrapper });
    expect(result.current.preview).toBeNull();

    await waitFor(() => expect(result.current.preview).toEqual({ crewName: "Crew", gcName: "GC" }));
    expect(api.previewCrewJoin).toHaveBeenCalledWith("tok");
  });

  it("surfaces a bad link at once, without retrying", async () => {
    vi.mocked(api.previewCrewJoin).mockRejectedValue(new Error("invalid"));

    const { result } = renderHook(() => useCrewJoinPreview("tok"), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(api.previewCrewJoin).toHaveBeenCalledTimes(1);
  });

  it("does nothing without a token", () => {
    renderHook(() => useCrewJoinPreview(undefined), { wrapper });

    expect(api.previewCrewJoin).not.toHaveBeenCalled();
  });
});
