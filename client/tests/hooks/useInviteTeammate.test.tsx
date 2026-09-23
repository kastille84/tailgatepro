import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useInviteTeammate } from "../../src/hooks/useInviteTeammate";
import * as apiCompanies from "../../src/services/apiCompanies";

vi.mock("react-hot-toast");
vi.mock("../../src/services/apiCompanies");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("useInviteTeammate", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ session: { access_token: "token-123" } });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("initializes with nothing in flight", () => {
    const { result } = renderHook(() => useInviteTeammate(), { wrapper });
    expect(result.current.isInviting).toBe(false);
  });

  it("calls apiCompanies.inviteTeammate with the session token and input, and toasts success", async () => {
    vi.mocked(apiCompanies.inviteTeammate).mockResolvedValue({
      email: "newhire@example.com",
      role: "foreman",
    });

    const { result } = renderHook(() => useInviteTeammate(), { wrapper });
    await result.current.inviteTeammate({ email: "newhire@example.com", role: "foreman" });

    expect(apiCompanies.inviteTeammate).toHaveBeenCalledWith("token-123", {
      email: "newhire@example.com",
      role: "foreman",
    });
    expect(toast.success).toHaveBeenCalledWith("Invite sent to newhire@example.com");
  });

  it("toasts the server message and rejects when sending fails", async () => {
    vi.mocked(apiCompanies.inviteTeammate).mockRejectedValue(
      new Error("You don't have permission to do this"),
    );

    const { result } = renderHook(() => useInviteTeammate(), { wrapper });

    await expect(
      result.current.inviteTeammate({ email: "newhire@example.com", role: "admin" }),
    ).rejects.toThrow("You don't have permission to do this");
    expect(toast.error).toHaveBeenCalledWith("You don't have permission to do this");
    expect(toast.success).not.toHaveBeenCalled();
  });
});
