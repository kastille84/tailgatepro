import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { GcLinkModal } from "../../../src/features/projects/GcLinkModal";
import theme from "../../../src/styles/theme";
import type { Project } from "../../../src/interfaces/project";

const mockUseOnlineStatus = vi.fn();
const mockUseLinkProjectToGc = vi.fn();
const mockLink = vi.fn();
const mockUnlink = vi.fn();

vi.mock("../../../src/context/online-status", () => ({
  useOnlineStatus: () => mockUseOnlineStatus(),
}));
vi.mock("../../../src/hooks/useLinkProjectToGc", () => ({
  useLinkProjectToGc: () => mockUseLinkProjectToGc(),
}));

const unlinkedProject: Project = {
  id: "p1",
  ownerCompanyId: "c1",
  name: "Downtown Highrise",
  gcCompanyId: null,
  gcNameCustom: "Old GC",
  gcContactEmail: null,
  status: "active",
  archivedAt: null,
  createdAt: "x",
};

const linkedProject: Project = {
  ...unlinkedProject,
  gcCompanyId: "gc-1",
  gcNameCustom: "Big GC",
};

const renderModal = (
  props: Partial<React.ComponentProps<typeof GcLinkModal>> = {},
) =>
  render(
    <ThemeProvider theme={theme}>
      <GcLinkModal project={unlinkedProject} onClose={vi.fn()} {...props} />
    </ThemeProvider>,
  );

describe("GcLinkModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOnlineStatus.mockReturnValue({ isOnline: true });
    mockLink.mockResolvedValue(undefined);
    mockUnlink.mockResolvedValue(undefined);
    mockUseLinkProjectToGc.mockReturnValue({
      linkProject: mockLink,
      unlinkProject: mockUnlink,
      isLinking: false,
      isUnlinking: false,
    });
  });

  describe("project not linked yet", () => {
    it("opens as a dialog with a join-code field and a Link button", () => {
      renderModal();

      expect(screen.getByRole("dialog")).toBeDefined();
      expect(screen.getByText("Link to a general contractor")).toBeDefined();
      expect(screen.getByLabelText(/gc join code/i)).toBeDefined();
      expect(screen.getByRole("button", { name: /link to gc/i })).toBeDefined();
      expect(screen.queryByRole("button", { name: /^unlink$/i })).toBeNull();
    });

    it("links with an upper-cased, trimmed code and closes", async () => {
      const onClose = vi.fn();
      renderModal({ onClose });

      fireEvent.change(screen.getByLabelText(/gc join code/i), {
        target: { value: "  k7m2q9xb " },
      });
      fireEvent.click(screen.getByRole("button", { name: /link to gc/i }));

      await waitFor(() =>
        expect(mockLink).toHaveBeenCalledWith({
          id: "p1",
          joinCode: "K7M2Q9XB",
        }),
      );
      await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it("asks for a code instead of calling the server when the field is empty", async () => {
      renderModal();

      fireEvent.click(screen.getByRole("button", { name: /link to gc/i }));

      expect(await screen.findByText(/enter the gc's join code/i)).toBeDefined();
      expect(mockLink).not.toHaveBeenCalled();
    });

    it("rejects an over-long code before calling the server", async () => {
      renderModal();

      fireEvent.change(screen.getByLabelText(/gc join code/i), {
        target: { value: "A".repeat(33) },
      });
      fireEvent.click(screen.getByRole("button", { name: /link to gc/i }));

      expect(await screen.findByText(/join code is too long/i)).toBeDefined();
      expect(mockLink).not.toHaveBeenCalled();
    });

    it("stays open when linking fails (the hook already toasts the reason)", async () => {
      const onClose = vi.fn();
      mockLink.mockRejectedValue(new Error("No GC matches that join code"));
      renderModal({ onClose });

      fireEvent.change(screen.getByLabelText(/gc join code/i), {
        target: { value: "NOPE" },
      });
      fireEvent.click(screen.getByRole("button", { name: /link to gc/i }));

      await waitFor(() => expect(mockLink).toHaveBeenCalled());
      expect(onClose).not.toHaveBeenCalled();
    });

    it("closes without linking when Cancel is clicked", () => {
      const onClose = vi.fn();
      renderModal({ onClose });

      fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

      expect(onClose).toHaveBeenCalled();
      expect(mockLink).not.toHaveBeenCalled();
    });

    it("shows the Link button as busy while linking", () => {
      mockUseLinkProjectToGc.mockReturnValue({
        linkProject: mockLink,
        unlinkProject: mockUnlink,
        isLinking: true,
        isUnlinking: false,
      });
      renderModal();

      expect(
        screen
          .getByRole("button", { name: /link to gc/i })
          .getAttribute("aria-busy"),
      ).toBe("true");
    });
  });

  describe("project already linked", () => {
    it("asks to confirm unlinking, naming the project and the GC, with no code field", () => {
      renderModal({ project: linkedProject });

      expect(screen.getByText("Unlink from GC")).toBeDefined();
      expect(screen.getByText("Big GC")).toBeDefined();
      expect(screen.queryByLabelText(/gc join code/i)).toBeNull();
    });

    it("unlinks and closes when Unlink is confirmed", async () => {
      const onClose = vi.fn();
      renderModal({ project: linkedProject, onClose });

      fireEvent.click(screen.getByRole("button", { name: /^unlink$/i }));

      await waitFor(() => expect(mockUnlink).toHaveBeenCalledWith("p1"));
      await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it("does not unlink when Cancel is clicked", () => {
      const onClose = vi.fn();
      renderModal({ project: linkedProject, onClose });

      fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

      expect(onClose).toHaveBeenCalled();
      expect(mockUnlink).not.toHaveBeenCalled();
    });

    it("stays open when unlinking fails (the hook already toasts the reason)", async () => {
      const onClose = vi.fn();
      mockUnlink.mockRejectedValue(new Error("unlink failed"));
      renderModal({ project: linkedProject, onClose });

      fireEvent.click(screen.getByRole("button", { name: /^unlink$/i }));

      await waitFor(() => expect(mockUnlink).toHaveBeenCalledWith("p1"));
      expect(onClose).not.toHaveBeenCalled();
    });

    it("shows the Unlink button as busy while unlinking", () => {
      mockUseLinkProjectToGc.mockReturnValue({
        linkProject: mockLink,
        unlinkProject: mockUnlink,
        isLinking: false,
        isUnlinking: true,
      });
      renderModal({ project: linkedProject });

      expect(
        screen
          .getByRole("button", { name: /^unlink$/i })
          .getAttribute("aria-busy"),
      ).toBe("true");
    });
  });

  describe("offline", () => {
    beforeEach(() => {
      mockUseOnlineStatus.mockReturnValue({ isOnline: false });
    });

    it("explains why linking is unavailable and disables the code field and Link button", () => {
      renderModal();

      expect(screen.getByRole("status").textContent).toMatch(/you're offline/i);
      expect(
        (screen.getByLabelText(/gc join code/i) as HTMLInputElement).disabled,
      ).toBe(true);
      expect(
        (screen.getByRole("button", { name: /link to gc/i }) as HTMLButtonElement)
          .disabled,
      ).toBe(true);
    });

    it("disables Unlink for a linked project", () => {
      renderModal({ project: linkedProject });

      expect(screen.getByRole("status").textContent).toMatch(/you're offline/i);
      expect(
        (screen.getByRole("button", { name: /^unlink$/i }) as HTMLButtonElement)
          .disabled,
      ).toBe(true);
    });
  });

  it("shows no offline note while online", () => {
    renderModal();
    expect(screen.queryByRole("status")).toBeNull();
  });
});
