import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "styled-components";

import { CrewInviteModal } from "../../../src/features/in-house-crews/CrewInviteModal";
import { CrewRenameModal } from "../../../src/features/in-house-crews/CrewRenameModal";
import { PlanLimitError } from "../../../src/utils/PlanLimitError";
import theme from "../../../src/styles/theme";

const mockUseOnlineStatus = vi.fn();
const mockUseActions = vi.fn();
const mockInvite = vi.fn();
const mockUpdate = vi.fn();

vi.mock("../../../src/context/online-status", () => ({
  useOnlineStatus: () => mockUseOnlineStatus(),
}));
vi.mock("../../../src/hooks/useInHouseCrews", () => ({
  useInHouseCrewActions: () => mockUseActions(),
}));

const crew = { id: "c1", name: "Hyperion - Framing", archivedAt: null, createdAt: "x" };

const wrap = (node: React.ReactNode) =>
  render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>{node}</ThemeProvider>
    </MemoryRouter>,
  );

describe("crew modals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOnlineStatus.mockReturnValue({ isOnline: true });
    mockInvite.mockResolvedValue({ email: "f@example.com", role: "foreman" });
    mockUpdate.mockResolvedValue(crew);
    mockUseActions.mockReturnValue({
      inviteCrewMember: mockInvite,
      isInviting: false,
      invitePlanLimitError: null,
      updateCrew: mockUpdate,
      isUpdating: false,
    });
  });

  describe("CrewInviteModal", () => {
    const open = (onClose = vi.fn()) => {
      wrap(<CrewInviteModal crew={crew} onClose={onClose} />);
      return onClose;
    };

    it("names the crew and offers no Superintendent role", () => {
      open();

      expect(screen.getByRole("dialog", { name: /invite to hyperion - framing/i })).toBeDefined();
      const roles = Array.from((screen.getByLabelText(/role/i) as HTMLSelectElement).options).map(
        (option) => option.value,
      );
      expect(roles).toEqual(["foreman", "safety_manager", "admin"]);
    });

    it("sends the invite for this crew and closes", async () => {
      const onClose = open();

      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "f@example.com" } });
      fireEvent.change(screen.getByLabelText(/role/i), { target: { value: "admin" } });
      fireEvent.click(screen.getByRole("button", { name: "Send invite" }));

      await waitFor(() =>
        expect(mockInvite).toHaveBeenCalledWith({
          crewId: "c1",
          email: "f@example.com",
          role: "admin",
        }),
      );
      await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it("validates the email", async () => {
      open();

      fireEvent.click(screen.getByRole("button", { name: "Send invite" }));
      expect(await screen.findByText("Email is required")).toBeDefined();

      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "nope" } });
      fireEvent.click(screen.getByRole("button", { name: "Send invite" }));
      expect(await screen.findByText("Enter a valid email address")).toBeDefined();
      expect(mockInvite).not.toHaveBeenCalled();
    });

    it("stays open when the invite fails", async () => {
      mockInvite.mockRejectedValue(new Error("nope"));
      const onClose = open();

      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "f@example.com" } });
      fireEvent.click(screen.getByRole("button", { name: "Send invite" }));

      await waitFor(() => expect(mockInvite).toHaveBeenCalled());
      expect(onClose).not.toHaveBeenCalled();
    });

    it("cancels without sending", () => {
      const onClose = open();

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(onClose).toHaveBeenCalled();
      expect(mockInvite).not.toHaveBeenCalled();
    });

    it("shows the upgrade prompt on a seat-limit rejection", () => {
      mockUseActions.mockReturnValue({
        inviteCrewMember: mockInvite,
        isInviting: false,
        invitePlanLimitError: new PlanLimitError("Seat limit reached", 1),
      });
      open();

      expect(screen.getByRole("alert").textContent).toContain("Seat limit reached");
      expect(screen.getByRole("link", { name: /see plans/i }).getAttribute("href")).toBe("/pricing");
    });

    it("explains and disables sending while offline", () => {
      mockUseOnlineStatus.mockReturnValue({ isOnline: false });
      open();

      expect(screen.getByRole("status").textContent).toMatch(/you're offline/i);
      expect((screen.getByRole("button", { name: "Send invite" }) as HTMLButtonElement).disabled).toBe(
        true,
      );
    });
  });

  describe("CrewRenameModal", () => {
    const open = (onClose = vi.fn()) => {
      wrap(<CrewRenameModal crew={crew} onClose={onClose} />);
      return onClose;
    };

    it("starts from the current name, saves the new one and closes", async () => {
      const onClose = open();
      const input = screen.getByLabelText(/crew name/i) as HTMLInputElement;
      expect(input.value).toBe("Hyperion - Framing");

      fireEvent.change(input, { target: { value: "Hyperion - Rough Framing" } });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() =>
        expect(mockUpdate).toHaveBeenCalledWith({
          id: "c1",
          patch: { name: "Hyperion - Rough Framing" },
        }),
      );
      await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it("requires a name and caps its length", async () => {
      open();
      const input = screen.getByLabelText(/crew name/i);

      fireEvent.change(input, { target: { value: "" } });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      expect(await screen.findByText("Crew name is required")).toBeDefined();

      fireEvent.change(input, { target: { value: "a".repeat(121) } });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      expect(await screen.findByText("Crew name is too long")).toBeDefined();
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("stays open when the rename fails", async () => {
      mockUpdate.mockRejectedValue(new Error("duplicate"));
      const onClose = open();

      fireEvent.change(screen.getByLabelText(/crew name/i), { target: { value: "Other" } });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
      expect(onClose).not.toHaveBeenCalled();
    });

    it("cancels without saving", () => {
      const onClose = open();

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(onClose).toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });
});
