import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useInvitePreview } from "../../src/hooks/useInvitePreview";
import * as apiCompanies from "../../src/services/apiCompanies";

vi.mock("../../src/services/apiCompanies");

const preview = {
  companyName: "Rivera Electric",
  email: "newhire@example.com",
  role: "foreman" as const,
};

describe("useInvitePreview", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("is disabled and returns a null preview when no token is given", () => {
    const { result } = renderHook(() => useInvitePreview(undefined), { wrapper });

    expect(result.current.preview).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(apiCompanies.getInvitePreview).not.toHaveBeenCalled();
  });

  it("resolves the preview once the query succeeds", async () => {
    vi.mocked(apiCompanies.getInvitePreview).mockResolvedValue(preview);

    const { result } = renderHook(() => useInvitePreview("a".repeat(64)), {
      wrapper,
    });

    await waitFor(() => expect(result.current.preview).toEqual(preview));
    expect(apiCompanies.getInvitePreview).toHaveBeenCalledWith("a".repeat(64));
  });

  it("reports isError on an invalid/expired token", async () => {
    vi.mocked(apiCompanies.getInvitePreview).mockRejectedValue(
      new Error("This invite link is invalid or has expired"),
    );

    const { result } = renderHook(() => useInvitePreview("bad-token"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.preview).toBeNull();
  });
});
