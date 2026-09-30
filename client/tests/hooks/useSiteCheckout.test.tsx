import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useSiteCheckout } from "../../src/hooks/useSiteCheckout";
import * as apiStripe from "../../src/services/apiStripe";

vi.mock("../../src/services/apiStripe");
vi.mock("react-hot-toast", () => {
  const toastFn = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() });
  return { default: toastFn };
});

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("useSiteCheckout", () => {
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

  it("creates a session for the jobsite and sends the browser to Checkout", async () => {
    vi.mocked(apiStripe.createSiteCheckoutSession).mockResolvedValue({
      url: "https://checkout.stripe.com/s",
    });

    const { result } = renderHook(() => useSiteCheckout(), { wrapper });
    expect(result.current.isStarting).toBe(false);
    result.current.startSiteCheckout({ jobsiteId: "site-1", interval: "monthly" });

    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith("https://checkout.stripe.com/s"),
    );
    expect(apiStripe.createSiteCheckoutSession).toHaveBeenCalledWith(
      "token-123",
      "site-1",
      "monthly",
    );
  });

  it("toasts the error instead of redirecting when the request fails", async () => {
    vi.mocked(apiStripe.createSiteCheckoutSession).mockRejectedValue(
      new Error("This jobsite is already on Site Pro"),
    );

    const { result } = renderHook(() => useSiteCheckout(), { wrapper });
    result.current.startSiteCheckout({ jobsiteId: "site-1", interval: "annual" });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("This jobsite is already on Site Pro"),
    );
    expect(assign).not.toHaveBeenCalled();
  });
});
