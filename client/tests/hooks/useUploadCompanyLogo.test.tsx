import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useUploadCompanyLogo } from "../../src/hooks/useUploadCompanyLogo";
import * as apiCompanies from "../../src/services/apiCompanies";

vi.mock("react-hot-toast");
vi.mock("../../src/services/apiCompanies");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const company = {
  id: "company-1",
  name: "Acme Roofing",
  companyType: "subcontractor",
  tier: "premium",
  logoPath: "company-1/logo",
};

const blob = new Blob(["png-bytes"], { type: "image/png" });

describe("useUploadCompanyLogo", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ session: { access_token: "token-123" } });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("initializes with isUploading false", () => {
    const { result } = renderHook(() => useUploadCompanyLogo(), { wrapper });
    expect(result.current.isUploading).toBe(false);
  });

  it("calls apiCompanies.uploadCompanyLogo with the session token and blob", async () => {
    vi.mocked(apiCompanies.uploadCompanyLogo).mockResolvedValue(company);

    const { result } = renderHook(() => useUploadCompanyLogo(), { wrapper });
    await expect(result.current.uploadLogo(blob)).resolves.toEqual(company);

    expect(apiCompanies.uploadCompanyLogo).toHaveBeenCalledWith(
      "token-123",
      blob,
    );
  });

  it("invalidates the companyLogo query on success", async () => {
    vi.mocked(apiCompanies.uploadCompanyLogo).mockResolvedValue(company);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUploadCompanyLogo(), { wrapper });
    await result.current.uploadLogo(blob);

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["companyLogo"],
      }),
    );
  });

  it("toasts and rejects when the upload fails", async () => {
    vi.mocked(apiCompanies.uploadCompanyLogo).mockRejectedValue(
      new Error("Upgrade to Trade Pro to upload a company logo"),
    );

    const { result } = renderHook(() => useUploadCompanyLogo(), { wrapper });

    await expect(result.current.uploadLogo(blob)).rejects.toThrow(
      "Upgrade to Trade Pro to upload a company logo",
    );
    expect(toast.error).toHaveBeenCalledWith(
      "Upgrade to Trade Pro to upload a company logo",
    );
  });
});
