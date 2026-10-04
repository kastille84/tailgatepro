import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { PushTopicForm } from "../../../src/features/gc-policy-push/PushTopicForm";
import theme from "../../../src/styles/theme";

const mockUseGcPolicyPushTalks = vi.fn();
const mockPushTopic = vi.fn();

vi.mock("../../../src/hooks/useGcPolicyPushTalks", () => ({
  useGcPolicyPushTalks: (...args: unknown[]) => mockUseGcPolicyPushTalks(...args),
}));
vi.mock("../../../src/hooks/usePushPolicyTopic", () => ({
  usePushPolicyTopic: () => ({ pushTopic: mockPushTopic, isPushing: false }),
}));

const renderForm = () =>
  render(
    <ThemeProvider theme={theme}>
      <PushTopicForm />
    </ThemeProvider>,
  );

describe("PushTopicForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGcPolicyPushTalks.mockReturnValue({
      talks: [
        { id: "talk-1", title: "Fall Protection", tradeTag: null },
        { id: "talk-2", title: "Ladder Safety", tradeTag: null },
      ],
      isLoading: false,
    });
    mockPushTopic.mockResolvedValue(undefined);
  });

  it("disables the push button until a topic is selected", () => {
    renderForm();

    expect(
      screen.getByRole("button", { name: /push to all active sites/i }),
    ).toHaveProperty("disabled", true);
  });

  it("opens a confirmation dialog naming the selected talk, and pushes it on confirm", async () => {
    renderForm();

    fireEvent.change(screen.getByLabelText(/topic to push/i), {
      target: { value: "talk-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /push to all active sites/i }));

    expect(screen.getByText("Fall Protection", { selector: "strong" })).toBeDefined();

    const confirmButtons = screen.getAllByRole("button", { name: /^push topic$/i });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(mockPushTopic).toHaveBeenCalledWith("talk-1"));
  });

  it("closes the dialog without pushing when cancelled", () => {
    renderForm();

    fireEvent.change(screen.getByLabelText(/topic to push/i), {
      target: { value: "talk-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /push to all active sites/i }));

    const cancelButtons = screen.getAllByRole("button", { name: /^cancel$/i });
    fireEvent.click(cancelButtons[cancelButtons.length - 1]);

    expect(mockPushTopic).not.toHaveBeenCalled();
  });

  it("disables the select and shows a loading placeholder while talks are loading", () => {
    mockUseGcPolicyPushTalks.mockReturnValue({ talks: [], isLoading: true });

    renderForm();

    const select = screen.getByLabelText(/topic to push/i) as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    expect(screen.getByText(/loading talks/i)).toBeDefined();
  });
});
