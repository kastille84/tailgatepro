import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useJoinCode } from "../../src/hooks/useJoinCode";
import * as apiCompanies from "../../src/services/apiCompanies";

vi.mock("../../src/services/apiCompanies");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockUseCurrentUser = vi.fn();
vi.mock("../../src/hooks/useCurrentUser", () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));

describe("useJoinCode", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ session: { access_token: "token-123" } });
    mockUseCurrentUser.mockReturnValue({ isGc: true });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("fetches the join code with the session token for a GC", async () => {
    vi.mocked(apiCompanies.getJoinCode).mockResolvedValue("K7M2Q9XB");

    const { result } = renderHook(() => useJoinCode(), { wrapper });

    await waitFor(() => expect(result.current.joinCode).toBe("K7M2Q9XB"));
    expect(apiCompanies.getJoinCode).toHaveBeenCalledWith("token-123");
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it("reports isError when the fetch fails", async () => {
    vi.mocked(apiCompanies.getJoinCode).mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useJoinCode(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.joinCode).toBeNull();
  });

  it("does not fetch for a company that is not a GC (the endpoint would 403)", () => {
    mockUseCurrentUser.mockReturnValue({ isGc: false });

    const { result } = renderHook(() => useJoinCode(), { wrapper });

    expect(apiCompanies.getJoinCode).not.toHaveBeenCalled();
    expect(result.current.joinCode).toBeNull();
  });

  it("does not fetch without a session", () => {
    mockUseAuth.mockReturnValue({ session: null });

    const { result } = renderHook(() => useJoinCode(), { wrapper });

    expect(apiCompanies.getJoinCode).not.toHaveBeenCalled();
    expect(result.current.joinCode).toBeNull();
  });
});
