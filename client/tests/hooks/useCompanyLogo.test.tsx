import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useCompanyLogo } from "../../src/hooks/useCompanyLogo";
import * as apiCompanies from "../../src/services/apiCompanies";

vi.mock("../../src/services/apiCompanies");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("useCompanyLogo", () => {
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

  it("fetches the signed logo URL with the session token", async () => {
    vi.mocked(apiCompanies.getCompanyLogoUrl).mockResolvedValue(
      "https://signed.example/logo.png",
    );

    const { result } = renderHook(() => useCompanyLogo(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(apiCompanies.getCompanyLogoUrl).toHaveBeenCalledWith("token-123");
    expect(result.current.logoUrl).toBe("https://signed.example/logo.png");
  });

  it("reports logoUrl null when no logo has been uploaded", async () => {
    vi.mocked(apiCompanies.getCompanyLogoUrl).mockResolvedValue(null);

    const { result } = renderHook(() => useCompanyLogo(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.logoUrl).toBeNull();
  });

  it("is disabled (no fetch, logoUrl null) without a session", () => {
    mockUseAuth.mockReturnValue({ session: null });

    const { result } = renderHook(() => useCompanyLogo(), { wrapper });

    expect(apiCompanies.getCompanyLogoUrl).not.toHaveBeenCalled();
    expect(result.current.logoUrl).toBeNull();
  });

  it("reports isLoading true before the query resolves", () => {
    vi.mocked(apiCompanies.getCompanyLogoUrl).mockReturnValue(
      new Promise(() => {}),
    );

    const { result } = renderHook(() => useCompanyLogo(), { wrapper });

    expect(result.current.isLoading).toBe(true);
  });
});
