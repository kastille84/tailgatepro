import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useMySmsOptIn } from "../../src/hooks/useMySmsOptIn";
import { useJobsiteSmsRecipients } from "../../src/hooks/useJobsiteSmsRecipients";
import * as apiSms from "../../src/services/apiSms";
import { PlanLimitError } from "../../src/utils/PlanLimitError";

vi.mock("react-hot-toast");
vi.mock("../../src/services/apiSms");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const recipient = {
  id: "r1",
  subCompanyId: "sub1",
  jobsiteId: null,
  phone: "+15125550123",
  source: "foreman" as const,
  consentedAt: "2026-10-01T00:00:00Z",
  confirmedAt: "2026-10-01T00:00:00Z",
  optedOut: false,
  subCompanyName: null,
};

let queryClient: QueryClient;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ session: { access_token: "token-123" } });
});

describe("useMySmsOptIn", () => {
  it("loads the caller's opt-in with the session token", async () => {
    vi.mocked(apiSms.getMySmsOptIn).mockResolvedValue(recipient);

    const { result } = renderHook(() => useMySmsOptIn(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(apiSms.getMySmsOptIn).toHaveBeenCalledWith("token-123");
    expect(result.current.optIn).toEqual(recipient);
    expect(result.current.isError).toBe(false);
  });

  it("returns null when never opted in, and does not fetch without a session", async () => {
    vi.mocked(apiSms.getMySmsOptIn).mockResolvedValue(null);
    const { result } = renderHook(() => useMySmsOptIn(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.optIn).toBeNull();

    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ session: null });
    renderHook(() => useMySmsOptIn(), { wrapper });
    expect(apiSms.getMySmsOptIn).not.toHaveBeenCalled();
  });

  it("reports a load error", async () => {
    vi.mocked(apiSms.getMySmsOptIn).mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useMySmsOptIn(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("saves the phone, toasts, and refetches", async () => {
    vi.mocked(apiSms.getMySmsOptIn).mockResolvedValue(null);
    vi.mocked(apiSms.saveMySmsOptIn).mockResolvedValue(recipient);
    const { result } = renderHook(() => useMySmsOptIn(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await result.current.saveOptIn("5125550123");

    expect(apiSms.saveMySmsOptIn).toHaveBeenCalledWith("token-123", "5125550123");
    expect(toast.success).toHaveBeenCalledWith("Text reminders are on");
    await waitFor(() => expect(apiSms.getMySmsOptIn).toHaveBeenCalledTimes(2));
  });

  it("toasts the server message when saving fails", async () => {
    vi.mocked(apiSms.getMySmsOptIn).mockResolvedValue(null);
    vi.mocked(apiSms.saveMySmsOptIn).mockRejectedValue(new Error("Bad number"));
    const { result } = renderHook(() => useMySmsOptIn(), { wrapper });

    await expect(result.current.saveOptIn("x")).rejects.toThrow("Bad number");
    expect(toast.error).toHaveBeenCalledWith("Bad number");
  });

  it("clears the opt-in, toasts, and handles failure", async () => {
    vi.mocked(apiSms.getMySmsOptIn).mockResolvedValue(recipient);
    vi.mocked(apiSms.clearMySmsOptIn).mockResolvedValue(undefined);
    const { result } = renderHook(() => useMySmsOptIn(), { wrapper });

    await result.current.clearOptIn();
    expect(apiSms.clearMySmsOptIn).toHaveBeenCalledWith("token-123");
    expect(toast.success).toHaveBeenCalledWith("Text reminders are off");

    vi.mocked(apiSms.clearMySmsOptIn).mockRejectedValue(new Error("nope"));
    await expect(result.current.clearOptIn()).rejects.toThrow("nope");
    expect(toast.error).toHaveBeenCalledWith("nope");
  });
});

describe("useJobsiteSmsRecipients", () => {
  const gcRecipient = { ...recipient, source: "gc" as const, jobsiteId: "j1" };

  it("lists a jobsite's recipients", async () => {
    vi.mocked(apiSms.listJobsiteSmsRecipients).mockResolvedValue([gcRecipient]);

    const { result } = renderHook(() => useJobsiteSmsRecipients("j1"), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(apiSms.listJobsiteSmsRecipients).toHaveBeenCalledWith("token-123", "j1");
    expect(result.current.recipients).toEqual([gcRecipient]);
    expect(result.current.isError).toBe(false);
  });

  it("does not fetch without a session or a jobsite id", () => {
    mockUseAuth.mockReturnValue({ session: null });
    const { result } = renderHook(() => useJobsiteSmsRecipients("j1"), { wrapper });
    expect(result.current.recipients).toEqual([]);

    mockUseAuth.mockReturnValue({ session: { access_token: "t" } });
    renderHook(() => useJobsiteSmsRecipients(undefined), { wrapper });
    expect(apiSms.listJobsiteSmsRecipients).not.toHaveBeenCalled();
  });

  it("reports a load error", async () => {
    vi.mocked(apiSms.listJobsiteSmsRecipients).mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useJobsiteSmsRecipients("j1"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("adds a recipient and toasts", async () => {
    vi.mocked(apiSms.listJobsiteSmsRecipients).mockResolvedValue([]);
    vi.mocked(apiSms.addJobsiteSmsRecipient).mockResolvedValue(gcRecipient);
    const { result } = renderHook(() => useJobsiteSmsRecipients("j1"), { wrapper });

    await result.current.addRecipient({ rosterId: "m1", phone: "5125550123" });

    expect(apiSms.addJobsiteSmsRecipient).toHaveBeenCalledWith("token-123", "j1", {
      rosterId: "m1",
      phone: "5125550123",
    });
    expect(toast.success).toHaveBeenCalled();
  });

  it("toasts a failed add but stays quiet for a plan-limit error", async () => {
    vi.mocked(apiSms.listJobsiteSmsRecipients).mockResolvedValue([]);
    const { result } = renderHook(() => useJobsiteSmsRecipients("j1"), { wrapper });

    vi.mocked(apiSms.addJobsiteSmsRecipient).mockRejectedValue(new Error("Bad number"));
    await expect(result.current.addRecipient({ rosterId: "m1", phone: "x" })).rejects.toThrow();
    expect(toast.error).toHaveBeenCalledWith("Bad number");

    vi.clearAllMocks();
    vi.mocked(apiSms.addJobsiteSmsRecipient).mockRejectedValue(new PlanLimitError("Upgrade"));
    await expect(result.current.addRecipient({ rosterId: "m1", phone: "x" })).rejects.toThrow();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("removes a recipient and toasts a failure", async () => {
    vi.mocked(apiSms.listJobsiteSmsRecipients).mockResolvedValue([gcRecipient]);
    vi.mocked(apiSms.removeJobsiteSmsRecipient).mockResolvedValue(undefined);
    const { result } = renderHook(() => useJobsiteSmsRecipients("j1"), { wrapper });

    await result.current.removeRecipient("r1");
    expect(apiSms.removeJobsiteSmsRecipient).toHaveBeenCalledWith("token-123", "j1", "r1");

    vi.mocked(apiSms.removeJobsiteSmsRecipient).mockRejectedValue(new Error("nope"));
    await expect(result.current.removeRecipient("r1")).rejects.toThrow("nope");
    expect(toast.error).toHaveBeenCalledWith("nope");
  });
});
