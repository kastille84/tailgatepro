import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { RequiredTopicBanner } from "../../../src/features/meeting-flow/RequiredTopicBanner";
import theme from "../../../src/styles/theme";

const mockUseRequiredTopic = vi.fn();

vi.mock("../../../src/hooks/useRequiredTopic", () => ({
  useRequiredTopic: (...args: unknown[]) => mockUseRequiredTopic(...args),
}));

const renderBanner = (projectId: string | undefined = "project-1") =>
  render(
    <ThemeProvider theme={theme}>
      <RequiredTopicBanner projectId={projectId} />
    </ThemeProvider>,
  );

describe("RequiredTopicBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when there's no required topic", () => {
    mockUseRequiredTopic.mockReturnValue({ requiredTopic: null });
    const { container } = renderBanner();
    expect(container.textContent).toBe("");
  });

  it("renders nothing when requiredTopic.talkId is null", () => {
    mockUseRequiredTopic.mockReturnValue({
      requiredTopic: { talkId: null, talkTitle: null, pushedAt: null },
    });
    const { container } = renderBanner();
    expect(container.textContent).toBe("");
  });

  it("nudges toward the GC's required topic by title", () => {
    mockUseRequiredTopic.mockReturnValue({
      requiredTopic: {
        talkId: "talk-1",
        talkTitle: "Fall Protection",
        pushedAt: "2026-09-01T00:00:00.000Z",
      },
    });
    renderBanner();
    expect(screen.getByText(/your gc requires this topic: fall protection/i)).toBeDefined();
  });

  it("falls back to a placeholder title when talkTitle is null (a deleted talk)", () => {
    mockUseRequiredTopic.mockReturnValue({
      requiredTopic: { talkId: "talk-1", talkTitle: null, pushedAt: "x" },
    });
    renderBanner();
    expect(screen.getByText(/your gc requires this topic: unknown talk/i)).toBeDefined();
  });

  it("passes the given projectId through to the hook", () => {
    mockUseRequiredTopic.mockReturnValue({ requiredTopic: null });
    renderBanner("project-9");
    expect(mockUseRequiredTopic).toHaveBeenCalledWith("project-9");
  });
});
