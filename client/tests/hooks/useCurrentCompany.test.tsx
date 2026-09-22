import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useCurrentCompany } from "../../src/hooks/useCurrentCompany";
import * as apiCompanies from "../../src/services/apiCompanies";

vi.mock("../../src/services/apiCompanies");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const company = {
  id: "company-1",
  name: "Acme Roofing",
  companyType: "subcontractor" as const,
  tier: "premium",
  logoPath: "company-1/logo",
};

describe("useCurrentCompany", () => {
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

  it("fetches the caller's own company with the session token", async () => {
    vi.mocked(apiCompanies.getMyCompany).mockResolvedValue(company);

    const { result } = renderHook(() => useCurrentCompany(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(apiCompanies.getMyCompany).toHaveBeenCalledWith("token-123");
    expect(result.current.company).toEqual(company);
  });

  it("does not fetch and returns a null company without a session", () => {
    mockUseAuth.mockReturnValue({ session: null });

    const { result } = renderHook(() => useCurrentCompany(), { wrapper });

    expect(apiCompanies.getMyCompany).not.toHaveBeenCalled();
    expect(result.current.company).toBeNull();
  });
});
