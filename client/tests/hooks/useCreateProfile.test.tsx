import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useCreateProfile } from "../../src/hooks/useCreateProfile";
import * as apiUsersModule from "../../src/services/apiUsers";

vi.mock("react-hot-toast");
vi.mock("../../src/services/apiUsers");

describe("useCreateProfile", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const payload = {
    name: "Alex Builder",
    companyName: "Rivera Electric",
    companyType: "subcontractor" as const,
    accessToken: "token-123",
  };

  it("should initialize with isCreating false", () => {
    const { result } = renderHook(() => useCreateProfile(), { wrapper });

    expect(result.current.createProfile).toBeDefined();
    expect(result.current.isCreating).toBe(false);
  });

  it("should call apiUsers.createProfile with the given payload and resolve with its result", async () => {
    vi.mocked(apiUsersModule.createProfile).mockResolvedValue({
      id: "user-1",
      name: "Alex Builder",
      role: "foreman",
      companyId: "company-1",
    });

    const { result } = renderHook(() => useCreateProfile(), { wrapper });

    await expect(result.current.createProfile(payload)).resolves.toEqual({
      id: "user-1",
      name: "Alex Builder",
      role: "foreman",
      companyId: "company-1",
    });
    expect(apiUsersModule.createProfile).toHaveBeenCalledTimes(1);
    expect(apiUsersModule.createProfile).toHaveBeenCalledWith(
      payload,
      expect.anything(),
    );
  });

  it("should set isCreating to true while the mutation is pending", async () => {
    vi.mocked(apiUsersModule.createProfile).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                id: "user-1",
                name: "Alex Builder",
                role: "foreman",
                companyId: "company-1",
              }),
            100,
          ),
        ),
    );

    const { result } = renderHook(() => useCreateProfile(), { wrapper });

    expect(result.current.isCreating).toBe(false);

    result.current.createProfile(payload);

    await waitFor(() => {
      expect(result.current.isCreating).toBe(true);
    });

    await waitFor(() => {
      expect(result.current.isCreating).toBe(false);
    });
  });

  it("should show an error toast and reject when the mutation fails", async () => {
    vi.mocked(apiUsersModule.createProfile).mockRejectedValue(
      new Error("Could not finish setting up your account."),
    );

    const { result } = renderHook(() => useCreateProfile(), { wrapper });

    await expect(result.current.createProfile(payload)).rejects.toThrow(
      "Could not finish setting up your account.",
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Could not finish setting up your account.",
      );
    });
  });
});
