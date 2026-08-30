import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useWaitlist } from "../../src/hooks/useWaitlist";
import * as apiWaitlistModule from "../../src/services/apiWaitlist";

vi.mock("react-hot-toast");
vi.mock("../../src/services/apiWaitlist");

describe("useWaitlist", () => {
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

  it("should initialize with correct default state", () => {
    const { result } = renderHook(() => useWaitlist(), { wrapper });

    expect(result.current.joinWaitlist).toBeDefined();
    expect(result.current.isJoining).toBe(false);
    expect(result.current.hasJoined).toBe(false);
    expect(result.current.joinedEmail).toBe(null);
  });

  it("should call addToWaitlist with the correct payload when joinWaitlist is invoked", async () => {
    const mockAddToWaitlist = vi.fn().mockResolvedValue({
      email: "test@example.com",
    });
    vi.mocked(apiWaitlistModule.addToWaitlist).mockImplementation(
      mockAddToWaitlist,
    );

    const { result } = renderHook(() => useWaitlist(), { wrapper });

    const payload = { email: "test@example.com" };
    result.current.joinWaitlist(payload);

    await waitFor(() => {
      expect(mockAddToWaitlist).toHaveBeenCalled();
      // Check the first argument contains the email
      const firstCall = mockAddToWaitlist.mock.calls[0];
      expect(firstCall[0]).toEqual(expect.objectContaining(payload));
    });
  });

  it("should set isJoining to true while mutation is pending", async () => {
    vi.mocked(apiWaitlistModule.addToWaitlist).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ email: "test@example.com" }), 100),
        ),
    );

    const { result, rerender } = renderHook(() => useWaitlist(), { wrapper });

    // Initially not joining
    expect(result.current.isJoining).toBe(false);

    result.current.joinWaitlist({ email: "test@example.com" });

    // Wait for the state to update to pending
    await waitFor(() => {
      expect(result.current.isJoining).toBe(true);
    });

    // Then wait for it to complete
    await waitFor(() => {
      expect(result.current.isJoining).toBe(false);
    });
  });

  it("should update state and show success toast on successful mutation", async () => {
    const email = "john@example.com";
    vi.mocked(apiWaitlistModule.addToWaitlist).mockResolvedValue({ email });

    const { result } = renderHook(() => useWaitlist(), { wrapper });

    result.current.joinWaitlist({ email });

    await waitFor(() => {
      expect(result.current.hasJoined).toBe(true);
      expect(result.current.joinedEmail).toBe(email);
    });

    expect(toast.success).toHaveBeenCalledWith(
      `You're on the list! We'll email ${email} when TailgatePro launches.`,
    );
  });

  it("should show error toast on failed mutation", async () => {
    const errorMessage = "Network error";
    vi.mocked(apiWaitlistModule.addToWaitlist).mockRejectedValue(
      new Error(errorMessage),
    );

    const { result } = renderHook(() => useWaitlist(), { wrapper });

    result.current.joinWaitlist({ email: "test@example.com" });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(errorMessage);
    });
  });

  it("should handle null email in success response", async () => {
    vi.mocked(apiWaitlistModule.addToWaitlist).mockResolvedValue({
      email: null,
    });

    const { result } = renderHook(() => useWaitlist(), { wrapper });

    result.current.joinWaitlist({ email: "test@example.com" });

    await waitFor(() => {
      expect(result.current.joinedEmail).toBe(null);
    });
  });

  it("should maintain hasJoined state across multiple calls if first succeeded", async () => {
    vi.mocked(apiWaitlistModule.addToWaitlist).mockResolvedValue({
      email: "first@example.com",
    });

    const { result } = renderHook(() => useWaitlist(), { wrapper });

    result.current.joinWaitlist({ email: "first@example.com" });

    await waitFor(() => {
      expect(result.current.hasJoined).toBe(true);
    });

    expect(result.current.hasJoined).toBe(true);
  });

  it("should reset error state when retrying after failure", async () => {
    vi.mocked(apiWaitlistModule.addToWaitlist)
      .mockRejectedValueOnce(new Error("First attempt failed"))
      .mockResolvedValueOnce({ email: "retry@example.com" });

    const { result } = renderHook(() => useWaitlist(), { wrapper });

    // First attempt fails
    result.current.joinWaitlist({ email: "retry@example.com" });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("First attempt failed");
    });

    vi.clearAllMocks();

    // Retry succeeds
    result.current.joinWaitlist({ email: "retry@example.com" });

    await waitFor(() => {
      expect(result.current.hasJoined).toBe(true);
      expect(toast.success).toHaveBeenCalled();
    });
  });
});
