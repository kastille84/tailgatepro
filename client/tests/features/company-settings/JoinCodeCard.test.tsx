import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import toast from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { JoinCodeCard } from "../../../src/features/company-settings";
import theme from "../../../src/styles/theme";

vi.mock("react-hot-toast");

const renderCard = (
  props: Partial<React.ComponentProps<typeof JoinCodeCard>> = {},
) =>
  render(
    <ThemeProvider theme={theme}>
      <JoinCodeCard
        joinCode="K7M2Q9XB"
        isLoading={false}
        isError={false}
        {...props}
      />
    </ThemeProvider>,
  );

const setClipboard = (clipboard: unknown) =>
  Object.defineProperty(navigator, "clipboard", {
    value: clipboard,
    configurable: true,
  });

describe("JoinCodeCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    setClipboard(undefined);
  });

  it("explains what the code is for and shows it with a Copy button", () => {
    renderCard();

    expect(screen.getByText(/give this code to your subcontractors/i)).toBeDefined();
    expect(screen.getByLabelText(/your join code/i).textContent).toBe("K7M2Q9XB");
    expect(screen.getByRole("button", { name: /copy code/i })).toBeDefined();
  });

  it("shows a loading indicator and no code or Copy button while loading", () => {
    renderCard({ joinCode: null, isLoading: true });

    expect(screen.getByText(/loading your join code/i)).toBeDefined();
    expect(screen.queryByRole("button", { name: /copy code/i })).toBeNull();
  });

  it("shows an error and no Copy button when the code could not be loaded", () => {
    renderCard({ joinCode: null, isError: true });

    expect(screen.getByRole("alert").textContent).toMatch(
      /could not load your join code/i,
    );
    expect(screen.queryByRole("button", { name: /copy code/i })).toBeNull();
  });

  it("copies the code to the clipboard and confirms with a toast", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: /copy code/i }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Join code copied"));
    expect(writeText).toHaveBeenCalledWith("K7M2Q9XB");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("tells the user to copy manually when the clipboard write is rejected", async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error("denied")) });
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: /copy code/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Could not copy. Select the code and copy it manually.",
      ),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("tells the user to copy manually when the clipboard API is unavailable", async () => {
    setClipboard(undefined);
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: /copy code/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
  });
});
