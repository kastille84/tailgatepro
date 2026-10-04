import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useBillingPortal } from "../../src/hooks/useBillingPortal";
import * as apiStripe from "../../src/services/apiStripe";

vi.mock("react-hot-toast");
vi.mock("../../src/services/apiStripe");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("useBillingPortal", () => {
  let assign: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ session: { access_token: "token-123" } });
    assign = vi.fn();
    vi.stubGlobal("location", { assign });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}
    >
      {children}
    </QueryClientProvider>
  );

  it("opens the portal url in this tab", async () => {
    vi.mocked(apiStripe.createPortalSession).mockResolvedValue({
      url: "https://billing.stripe.com/p",
    });

    const { result } = renderHook(() => useBillingPortal(), { wrapper });
    expect(result.current.isOpening).toBe(false);
    result.current.openPortal();

    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith("https://billing.stripe.com/p"),
    );
    expect(apiStripe.createPortalSession).toHaveBeenCalledWith("token-123");
  });

  it("toasts the server message on failure and does not redirect", async () => {
    vi.mocked(apiStripe.createPortalSession).mockRejectedValue(
      new Error("No billing account yet"),
    );

    const { result } = renderHook(() => useBillingPortal(), { wrapper });
    result.current.openPortal();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("No billing account yet"),
    );
    expect(assign).not.toHaveBeenCalled();
  });
});
