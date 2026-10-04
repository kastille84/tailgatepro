import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { SealBadge } from "../../../src/features/meeting-shared/SealBadge";
import theme from "../../../src/styles/theme";

const renderBadge = (props: Partial<React.ComponentProps<typeof SealBadge>> = {}) =>
  render(
    <ThemeProvider theme={theme}>
      <SealBadge
        meetingId="meeting-1"
        sealed
        onVerify={vi.fn()}
        isPending={false}
        {...props}
      />
    </ThemeProvider>,
  );

describe("SealBadge", () => {
  it("renders nothing when the meeting has no seal", () => {
    const { container } = renderBadge({ sealed: false });
    expect(container.innerHTML).toBe("");
  });

  it("shows the neutral Sealed pill and a Verify button when sealed but not yet checked", () => {
    renderBadge();

    expect(screen.getByText("Sealed")).toBeDefined();
    expect(screen.getByRole("button", { name: "Verify" })).toBeDefined();
  });

  it("calls onVerify with the meeting id when the Verify button is clicked", () => {
    const onVerify = vi.fn();
    renderBadge({ onVerify });

    fireEvent.click(screen.getByRole("button", { name: "Verify" }));

    expect(onVerify).toHaveBeenCalledWith("meeting-1");
  });

  it("shows the button as busy while this row's verification is pending", () => {
    renderBadge({ isPending: true, verifyingId: "meeting-1" });

    expect(screen.getByRole("button").getAttribute("aria-busy")).toBe("true");
  });

  it("does not show as busy when a different row's verification is pending", () => {
    renderBadge({ isPending: true, verifyingId: "meeting-2" });

    const button = screen.getByRole("button", { name: "Verify" });
    expect(button.getAttribute("aria-busy")).toBeNull();
  });

  it("shows a green Verified button and no tampered note when this row's result is valid", () => {
    renderBadge({
      verifyingId: "meeting-1",
      result: { valid: true, sealedAt: "2026-09-21T06:00:00.000Z" },
    });

    expect(screen.getByRole("button", { name: "Verified" })).toBeDefined();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows a red Tampered button and an explanatory note when this row's result is invalid", () => {
    renderBadge({
      verifyingId: "meeting-1",
      result: { valid: false, sealedAt: "2026-09-21T06:00:00.000Z" },
    });

    expect(screen.getByRole("button", { name: "Tampered" })).toBeDefined();
    expect(screen.getByRole("alert").textContent).toMatch(
      /this record's seal no longer matches/i,
    );
  });

  it("ignores a result that belongs to a different row's verification", () => {
    renderBadge({
      verifyingId: "meeting-2",
      result: { valid: true, sealedAt: "2026-09-21T06:00:00.000Z" },
    });

    expect(screen.getByRole("button", { name: "Verify" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Verified" })).toBeNull();
  });

  it("re-triggers verification when clicking the result button again", () => {
    const onVerify = vi.fn();
    renderBadge({
      onVerify,
      verifyingId: "meeting-1",
      result: { valid: true, sealedAt: "2026-09-21T06:00:00.000Z" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Verified" }));

    expect(onVerify).toHaveBeenCalledWith("meeting-1");
  });
});
