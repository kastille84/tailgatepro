import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useCheckout } from "../../src/hooks/useCheckout";
import * as apiStripe from "../../src/services/apiStripe";

vi.mock("../../src/services/apiStripe");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("useCheckout", () => {
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

  it("creates a session and sends the browser to the Checkout url", async () => {
    vi.mocked(apiStripe.createCheckoutSession).mockResolvedValue({
      url: "https://checkout.stripe.com/s",
    });

    const { result } = renderHook(() => useCheckout(), { wrapper });
    expect(result.current.isStarting).toBe(false);
    result.current.startCheckout({ plan: "trade-pro", interval: "monthly" });

    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith("https://checkout.stripe.com/s"),
    );
    expect(apiStripe.createCheckoutSession).toHaveBeenCalledWith(
      "token-123",
      "trade-pro",
      "monthly",
    );
  });

  it("exposes the error instead of redirecting when the request fails", async () => {
    vi.mocked(apiStripe.createCheckoutSession).mockRejectedValue(new Error("Nope"));

    const { result } = renderHook(() => useCheckout(), { wrapper });
    result.current.startCheckout({ plan: "trade-pro", interval: "annual" });

    await waitFor(() => expect(result.current.error?.message).toBe("Nope"));
    expect(assign).not.toHaveBeenCalled();
  });
});
