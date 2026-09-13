import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useDeleteTalk } from "../../src/hooks/useDeleteTalk";
import * as apiTalks from "../../src/services/apiTalks";

vi.mock("react-hot-toast");
vi.mock("../../src/services/apiTalks");

const mockUseAuth = vi.fn();
vi.mock("../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("useDeleteTalk", () => {
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

  it("initializes with isDeleting false", () => {
    const { result } = renderHook(() => useDeleteTalk(), { wrapper });
    expect(result.current.isDeleting).toBe(false);
  });

  it("deletes by id, toasts success, and invalidates the talks query", async () => {
    vi.mocked(apiTalks.deleteTalk).mockResolvedValue({ id: "talk-2" });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteTalk(), { wrapper });
    await result.current.deleteTalk("talk-2");

    expect(apiTalks.deleteTalk).toHaveBeenCalledWith("token-123", "talk-2");
    expect(toast.success).toHaveBeenCalledWith("Talk deleted");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["talks"] });
  });

  it("toasts the error (e.g. the 409 in-use guard) and rejects", async () => {
    vi.mocked(apiTalks.deleteTalk).mockRejectedValue(
      new Error(
        "This talk has been used in a logged safety talk and can't be edited or deleted.",
      ),
    );

    const { result } = renderHook(() => useDeleteTalk(), { wrapper });

    await expect(result.current.deleteTalk("talk-2")).rejects.toThrow(
      "can't be edited or deleted.",
    );
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("can't be edited or deleted."),
      ),
    );
  });
});
