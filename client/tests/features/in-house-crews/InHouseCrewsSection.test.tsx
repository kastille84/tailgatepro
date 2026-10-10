import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { InHouseCrewsSection } from "../../../src/features/in-house-crews/InHouseCrewsSection";
import theme from "../../../src/styles/theme";

const mockUseCrews = vi.fn();
const mockUseActions = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock("../../../src/hooks/useInHouseCrews", () => ({
  useInHouseCrews: () => mockUseCrews(),
  useInHouseCrewActions: () => mockUseActions(),
}));

// The modals have their own tests; stub them to keep this one on list behavior.
vi.mock("../../../src/features/in-house-crews/CrewForm", () => ({
  CrewForm: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div role="dialog">
        stub-crew-form
        <button type="button" onClick={onClose}>
          stub-form-close
        </button>
      </div>
    ) : null,
}));
vi.mock("../../../src/features/in-house-crews/CrewRenameModal", () => ({
  CrewRenameModal: ({ crew, onClose }: { crew: { name: string }; onClose: () => void }) => (
    <div role="dialog">
      stub-rename {crew.name}
      <button type="button" onClick={onClose}>
        stub-rename-close
      </button>
    </div>
  ),
}));
vi.mock("../../../src/features/in-house-crews/CrewInviteModal", () => ({
  CrewInviteModal: ({ crew, onClose }: { crew: { name: string }; onClose: () => void }) => (
    <div role="dialog">
      stub-invite {crew.name}
      <button type="button" onClick={onClose}>
        stub-invite-close
      </button>
    </div>
  ),
}));

vi.mock("../../../src/features/in-house-crews/CrewAccessModal", () => ({
  CrewAccessModal: ({ crew, onClose }: { crew: { name: string }; onClose: () => void }) => (
    <div role="dialog">
      stub-access {crew.name}
      <button type="button" onClick={onClose}>
        stub-access-close
      </button>
    </div>
  ),
}));

const active = { id: "c1", name: "Hyperion - Framing", archivedAt: null, createdAt: "x" };
const archived = { id: "c2", name: "Hyperion - Roofing", archivedAt: "2026-02-01", createdAt: "x" };

const renderSection = () =>
  render(
    <ThemeProvider theme={theme}>
      <InHouseCrewsSection />
    </ThemeProvider>,
  );

describe("InHouseCrewsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue(undefined);
    mockDelete.mockResolvedValue(undefined);
    mockUseCrews.mockReturnValue({ crews: [active, archived], isLoading: false, isError: false });
    mockUseActions.mockReturnValue({
      updateCrew: mockUpdate,
      isUpdating: false,
      deleteCrew: mockDelete,
      isDeleting: false,
    });
  });

  it("lists crews and marks an archived one", () => {
    renderSection();

    expect(screen.getByText("Hyperion - Framing")).toBeDefined();
    expect(screen.getByText(/Hyperion - Roofing \(archived\)/)).toBeDefined();
  });

  it("offers invites only for an active crew, and Restore for an archived one", () => {
    renderSection();

    expect(screen.getAllByRole("button", { name: "Invite someone" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Restore" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Archive" })).toBeDefined();
  });

  it("shows loading, error and empty states", () => {
    mockUseCrews.mockReturnValue({ crews: [], isLoading: true, isError: false });
    const { unmount } = renderSection();
    expect(screen.getByRole("status")).toBeDefined();
    expect(screen.queryByText("No in-house crews yet.")).toBeNull();
    unmount();

    mockUseCrews.mockReturnValue({ crews: [], isLoading: false, isError: true });
    const second = renderSection();
    expect(screen.getByRole("alert").textContent).toMatch(/could not load your crews/i);
    expect(screen.queryByText("No in-house crews yet.")).toBeNull();
    second.unmount();

    mockUseCrews.mockReturnValue({ crews: [], isLoading: false, isError: false });
    renderSection();
    expect(screen.getByText("No in-house crews yet.")).toBeDefined();
  });

  it("opens and closes the add-crews form", () => {
    renderSection();

    fireEvent.click(screen.getByRole("button", { name: "Add in-house crews" }));
    expect(screen.getByText("stub-crew-form")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "stub-form-close" }));
    expect(screen.queryByText("stub-crew-form")).toBeNull();
  });

  it("opens and closes the rename and invite modals for the chosen crew", () => {
    renderSection();

    fireEvent.click(screen.getAllByRole("button", { name: "Rename" })[0]);
    expect(screen.getByText(/stub-rename Hyperion - Framing/)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "stub-rename-close" }));
    expect(screen.queryByText(/stub-rename/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Invite someone" }));
    expect(screen.getByText(/stub-invite Hyperion - Framing/)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "stub-invite-close" }));
    expect(screen.queryByText(/stub-invite/)).toBeNull();
  });

  it("opens the people and join link modal for the chosen crew, archived ones included", () => {
    renderSection();

    const buttons = screen.getAllByRole("button", { name: "People & link" });
    expect(buttons).toHaveLength(2);

    fireEvent.click(buttons[1]);
    expect(screen.getByText(/stub-access Hyperion - Roofing/)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "stub-access-close" }));
    expect(screen.queryByText(/stub-access/)).toBeNull();
  });

  it("archives an active crew and restores an archived one", async () => {
    renderSection();

    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith({ id: "c1", patch: { archived: true } }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith({ id: "c2", patch: { archived: false } }),
    );
  });

  it("swallows an archive failure (already toasted by the hook)", async () => {
    mockUpdate.mockRejectedValue(new Error("boom"));
    renderSection();

    fireEvent.click(screen.getByRole("button", { name: "Archive" }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
  });

  it("confirms before deleting, then deletes", async () => {
    renderSection();

    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    expect(screen.getByText(/can't be deleted — archive it instead/i)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Delete crew" }));

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith("c1"));
    await waitFor(() => expect(screen.queryByText(/archive it instead/i)).toBeNull());
  });

  it("closes the confirmation even when the delete is refused", async () => {
    mockDelete.mockRejectedValue(new Error("has history"));
    renderSection();

    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Delete crew" }));

    await waitFor(() => expect(mockDelete).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText(/archive it instead/i)).toBeNull());
  });

  it("cancels the delete confirmation without deleting", () => {
    renderSection();

    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    const cancels = screen.getAllByRole("button", { name: /^cancel$/i });
    fireEvent.click(cancels[cancels.length - 1]);

    expect(mockDelete).not.toHaveBeenCalled();
    expect(screen.queryByText(/archive it instead/i)).toBeNull();
  });
});
