import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { ClearPushButton } from "../../../src/features/gc-policy-push/ClearPushButton";
import theme from "../../../src/styles/theme";

const mockClearPush = vi.fn();

vi.mock("../../../src/hooks/useClearPolicyPush", () => ({
  useClearPolicyPush: () => ({ clearPush: mockClearPush, isClearing: false }),
}));

const renderButton = () =>
  render(
    <ThemeProvider theme={theme}>
      <ClearPushButton />
    </ThemeProvider>,
  );

describe("ClearPushButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClearPush.mockResolvedValue(undefined);
  });

  it("opens a confirmation dialog and clears the push on confirm", async () => {
    renderButton();

    fireEvent.click(screen.getByRole("button", { name: /clear required topic/i }));
    expect(screen.getByText(/no topic will be required/i)).toBeDefined();

    const confirmButtons = screen.getAllByRole("button", { name: /^clear topic$/i });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(mockClearPush).toHaveBeenCalled());
  });

  it("closes the dialog without clearing when cancelled", () => {
    renderButton();

    fireEvent.click(screen.getByRole("button", { name: /clear required topic/i }));

    const cancelButtons = screen.getAllByRole("button", { name: /^cancel$/i });
    fireEvent.click(cancelButtons[cancelButtons.length - 1]);

    expect(mockClearPush).not.toHaveBeenCalled();
  });
});
