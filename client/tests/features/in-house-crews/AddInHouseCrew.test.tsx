import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { AddInHouseCrew } from "../../../src/features/in-house-crews/AddInHouseCrew";
import { InHouseBadge } from "../../../src/features/in-house-crews/InHouseBadge";
import theme from "../../../src/styles/theme";

const mockUseOnlineStatus = vi.fn();
const mockUseCrews = vi.fn();
const mockUseActions = vi.fn();
const mockAttach = vi.fn();

vi.mock("../../../src/context/online-status", () => ({
  useOnlineStatus: () => mockUseOnlineStatus(),
}));
vi.mock("../../../src/hooks/useInHouseCrews", () => ({
  useInHouseCrews: () => mockUseCrews(),
  useInHouseCrewActions: () => mockUseActions(),
}));

const framing = { id: "c1", name: "Hyperion - Framing", archivedAt: null, createdAt: "x" };
const roofing = { id: "c2", name: "Hyperion - Roofing", archivedAt: null, createdAt: "x" };
const retired = { id: "c3", name: "Hyperion - Old", archivedAt: "2026-01-01", createdAt: "x" };

const renderControl = (attachedCrewIds: string[] = []) =>
  render(
    <ThemeProvider theme={theme}>
      <AddInHouseCrew jobsiteId="j1" attachedCrewIds={attachedCrewIds} />
    </ThemeProvider>,
  );

describe("AddInHouseCrew", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOnlineStatus.mockReturnValue({ isOnline: true });
    mockAttach.mockResolvedValue(undefined);
    mockUseCrews.mockReturnValue({ crews: [framing, roofing, retired] });
    mockUseActions.mockReturnValue({ attachCrew: mockAttach, isAttaching: false });
  });

  it("offers only active crews that are not already on the site", () => {
    renderControl(["c1"]);

    expect(screen.getByRole("button", { name: "Add Hyperion - Roofing" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Add Hyperion - Framing" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add Hyperion - Old" })).toBeNull();
  });

  it("renders nothing when every active crew is already on the site", () => {
    const { container } = renderControl(["c1", "c2"]);

    expect(container.textContent).toBe("");
  });

  it("attaches the chosen crew to this job site", async () => {
    renderControl();

    fireEvent.click(screen.getByRole("button", { name: "Add Hyperion - Framing" }));

    await waitFor(() => expect(mockAttach).toHaveBeenCalledWith({ jobsiteId: "j1", crewId: "c1" }));
  });

  it("swallows an attach failure (already toasted by the hook)", async () => {
    mockAttach.mockRejectedValue(new Error("archived"));
    renderControl();

    fireEvent.click(screen.getByRole("button", { name: "Add Hyperion - Framing" }));

    await waitFor(() => expect(mockAttach).toHaveBeenCalled());
  });

  it("disables adding while offline", () => {
    mockUseOnlineStatus.mockReturnValue({ isOnline: false });
    renderControl();

    expect(
      (screen.getByRole("button", { name: "Add Hyperion - Framing" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});

describe("InHouseBadge", () => {
  it("labels a row as in-house", () => {
    render(
      <ThemeProvider theme={theme}>
        <InHouseBadge />
      </ThemeProvider>,
    );

    expect(screen.getByText("In-house")).toBeDefined();
  });
});
