import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useTranslationLanguages } from "../../src/hooks/useTranslationLanguages";
import * as apiTranslation from "../../src/services/apiTranslation";

vi.mock("../../src/services/apiTranslation");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockUseOnlineStatus = vi.fn();
vi.mock("../../src/context/online-status", () => ({
  useOnlineStatus: () => mockUseOnlineStatus(),
}));

const mockUseCurrentUser = vi.fn();
vi.mock("../../src/hooks/useCurrentUser", () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));

describe("useTranslationLanguages", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ session: { access_token: "token-123" } });
    mockUseOnlineStatus.mockReturnValue({ isOnline: true });
    mockUseCurrentUser.mockReturnValue({ hasTranslationAccess: true });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("fetches and exposes the supported languages when online with translation access", async () => {
    vi.mocked(apiTranslation.getTranslationLanguages).mockResolvedValue([
      { code: "es", name: "Spanish" },
    ]);

    const { result } = renderHook(() => useTranslationLanguages(), { wrapper });

    await waitFor(() => expect(result.current.languages).toHaveLength(1));
    expect(apiTranslation.getTranslationLanguages).toHaveBeenCalledWith(
      "token-123",
    );
    expect(result.current.isAvailable).toBe(true);
  });

  it("does not fetch, and reports unavailable, when offline", () => {
    mockUseOnlineStatus.mockReturnValue({ isOnline: false });

    const { result } = renderHook(() => useTranslationLanguages(), { wrapper });

    expect(apiTranslation.getTranslationLanguages).not.toHaveBeenCalled();
    expect(result.current.languages).toEqual([]);
    expect(result.current.isAvailable).toBe(false);
  });

  it("does not fetch, and reports unavailable, when the caller's tier lacks translation access", () => {
    mockUseCurrentUser.mockReturnValue({ hasTranslationAccess: false });

    const { result } = renderHook(() => useTranslationLanguages(), { wrapper });

    expect(apiTranslation.getTranslationLanguages).not.toHaveBeenCalled();
    expect(result.current.isAvailable).toBe(false);
  });

  it("reports unavailable when online with access but the server returns no languages", async () => {
    vi.mocked(apiTranslation.getTranslationLanguages).mockResolvedValue([]);

    const { result } = renderHook(() => useTranslationLanguages(), { wrapper });

    await waitFor(() =>
      expect(apiTranslation.getTranslationLanguages).toHaveBeenCalled(),
    );
    expect(result.current.isAvailable).toBe(false);
  });

  it("pins Spanish, Chinese, Vietnamese, Korean, and Portuguese to the front, in that order", async () => {
    vi.mocked(apiTranslation.getTranslationLanguages).mockResolvedValue([
      { code: "fr", name: "French" },
      { code: "pt", name: "Portuguese" },
      { code: "ko", name: "Korean" },
      { code: "zh-CN", name: "Chinese (Simplified)" },
      { code: "de", name: "German" },
      { code: "vi", name: "Vietnamese" },
      { code: "es", name: "Spanish" },
    ]);

    const { result } = renderHook(() => useTranslationLanguages(), { wrapper });

    await waitFor(() => expect(result.current.languages).toHaveLength(7));
    expect(result.current.languages.map((lang) => lang.code)).toEqual([
      "es",
      "zh-CN",
      "vi",
      "ko",
      "pt",
      "fr",
      "de",
    ]);
  });

  it("pins both Chinese variants together, ahead of Vietnamese, when the API returns two", async () => {
    vi.mocked(apiTranslation.getTranslationLanguages).mockResolvedValue([
      { code: "zh-TW", name: "Chinese (Traditional)" },
      { code: "vi", name: "Vietnamese" },
      { code: "zh-CN", name: "Chinese (Simplified)" },
      { code: "es", name: "Spanish" },
    ]);

    const { result } = renderHook(() => useTranslationLanguages(), { wrapper });

    await waitFor(() => expect(result.current.languages).toHaveLength(4));
    expect(result.current.languages.map((lang) => lang.code)).toEqual([
      "es",
      "zh-TW",
      "zh-CN",
      "vi",
    ]);
  });

  it("skips a popular language that the API doesn't return, without injecting a placeholder", async () => {
    vi.mocked(apiTranslation.getTranslationLanguages).mockResolvedValue([
      { code: "fr", name: "French" },
      { code: "es", name: "Spanish" },
    ]);

    const { result } = renderHook(() => useTranslationLanguages(), { wrapper });

    await waitFor(() => expect(result.current.languages).toHaveLength(2));
    expect(result.current.languages.map((lang) => lang.code)).toEqual([
      "es",
      "fr",
    ]);
  });
});
