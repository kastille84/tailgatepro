import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { MarkDayOffModal } from "../../../src/features/projects/MarkDayOffModal";
import theme from "../../../src/styles/theme";
import type { NoWorkDay } from "../../../src/interfaces/noWorkDay";
import type { Project } from "../../../src/interfaces/project";

const mockUseNoWorkDays = vi.fn();
const mockUseNoWorkDayActions = vi.fn();
const mockMarkDayOff = vi.fn();
const mockRemoveDayOff = vi.fn();

vi.mock("../../../src/hooks/useNoWorkDays", () => ({
  useNoWorkDays: (...args: unknown[]) => mockUseNoWorkDays(...args),
}));
vi.mock("../../../src/hooks/useNoWorkDayActions", () => ({
  useNoWorkDayActions: () => mockUseNoWorkDayActions(),
}));

const project: Project = {
  id: "p1",
  ownerCompanyId: "c1",
  name: "Downtown Highrise",
  gcCompanyId: "gc-1",
  jobsiteId: "j1",
  gcNameCustom: "Acme GC",
  gcContactEmail: null,
  status: "active",
  archivedAt: null,
  createdAt: "x",
};

const markedDay = (overrides: Partial<NoWorkDay>): NoWorkDay => ({
  id: "nwd-1",
  jobsiteId: "j1",
  companyId: "c1",
  offDate: "2026-09-24",
  reason: "holiday",
  createdBy: "u1",
  createdAt: "2026-09-20T00:00:00.000Z",
  ...overrides,
});

const renderModal = (onClose = vi.fn()) =>
  render(
    <ThemeProvider theme={theme}>
      <MarkDayOffModal project={project} onClose={onClose} />
    </ThemeProvider>,
  );

const setDate = (value: string) =>
  fireEvent.change(screen.getByLabelText("Day"), { target: { value } });

const confirmButton = (name: RegExp) =>
  screen.getByRole("button", { name }) as HTMLButtonElement;

// "Today" is pinned to Wednesday 2026-09-23 (local), so the picker range is
// 2026-09-16 through 2026-10-07.
describe("MarkDayOffModal", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 23, 12, 0, 0));
    vi.clearAllMocks();
    mockMarkDayOff.mockResolvedValue(undefined);
    mockRemoveDayOff.mockResolvedValue(undefined);
    mockUseNoWorkDays.mockReturnValue({ noWorkDays: [] });
    mockUseNoWorkDayActions.mockReturnValue({
      markDayOff: mockMarkDayOff,
      removeDayOff: mockRemoveDayOff,
      isMarking: false,
      isRemoving: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens as a dialog for the project, defaulting to today with the confirm disabled until a reason is picked", () => {
    renderModal();

    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText("Downtown Highrise — mark day off")).toBeDefined();
    expect((screen.getByLabelText("Day") as HTMLInputElement).value).toBe("2026-09-23");
    expect(mockUseNoWorkDays).toHaveBeenCalledWith("p1");
    expect(confirmButton(/mark wed, sep 23 off/i).disabled).toBe(true);
  });

  it("marks the chosen day off with the chosen reason, then closes", async () => {
    const onClose = vi.fn();
    renderModal(onClose);

    fireEvent.click(screen.getByRole("radio", { name: "Weather" }));
    fireEvent.click(confirmButton(/mark wed, sep 23 off/i));

    await waitFor(() =>
      expect(mockMarkDayOff).toHaveBeenCalledWith({
        projectId: "p1",
        offDate: "2026-09-23",
        reason: "weather",
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("moves to tomorrow and back to today with the quick buttons", () => {
    renderModal();

    fireEvent.click(screen.getByRole("button", { name: "Tomorrow" }));
    expect((screen.getByLabelText("Day") as HTMLInputElement).value).toBe("2026-09-24");
    expect(screen.getByRole("button", { name: /mark thu, sep 24 off/i })).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    expect((screen.getByLabelText("Day") as HTMLInputElement).value).toBe("2026-09-23");
  });

  it("limits the date picker to 7 days back through 14 days ahead", () => {
    renderModal();

    const input = screen.getByLabelText("Day") as HTMLInputElement;
    expect(input.min).toBe("2026-09-16");
    expect(input.max).toBe("2026-10-07");
  });

  it("ignores the browser clearing the date field", () => {
    renderModal();

    setDate("");

    expect((screen.getByLabelText("Day") as HTMLInputElement).value).toBe("2026-09-23");
  });

  it("refuses a weekend with an explanation, even once a reason is picked", () => {
    renderModal();

    setDate("2026-09-26");
    fireEvent.click(screen.getByRole("radio", { name: "Holiday" }));

    expect(screen.getByRole("alert").textContent).toMatch(/weekends are never required/i);
    expect(confirmButton(/mark sat, sep 26 off/i).disabled).toBe(true);
  });

  it("refuses a day outside the allowed range", () => {
    renderModal();

    setDate("2026-10-30");
    fireEvent.click(screen.getByRole("radio", { name: "Holiday" }));

    expect(screen.getByRole("alert").textContent).toMatch(/last 7 days up to 2 weeks ahead/i);
    expect(confirmButton(/mark fri, oct 30 off/i).disabled).toBe(true);
  });

  it("refuses a day that is already marked off", () => {
    mockUseNoWorkDays.mockReturnValue({ noWorkDays: [markedDay({ offDate: "2026-09-23" })] });
    renderModal();

    fireEvent.click(screen.getByRole("radio", { name: "Holiday" }));

    expect(screen.getByRole("alert").textContent).toMatch(/already marked off/i);
    expect(confirmButton(/mark wed, sep 23 off/i).disabled).toBe(true);
  });

  it("stays open when marking fails (the hook already toasts)", async () => {
    mockMarkDayOff.mockRejectedValue(new Error("Project not found"));
    const onClose = vi.fn();
    renderModal(onClose);

    fireEvent.click(screen.getByRole("radio", { name: "Other" }));
    fireEvent.click(confirmButton(/mark wed, sep 23 off/i));

    await waitFor(() => expect(mockMarkDayOff).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes from Cancel without marking anything", () => {
    const onClose = vi.fn();
    renderModal(onClose);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
    expect(mockMarkDayOff).not.toHaveBeenCalled();
  });

  describe("days already marked off", () => {
    it("lists nothing when there are none", () => {
      renderModal();

      expect(screen.queryByText("Already marked off")).toBeNull();
    });

    it("lists each mark with its reason and removes one on request", async () => {
      mockUseNoWorkDays.mockReturnValue({
        noWorkDays: [markedDay({ id: "nwd-1", offDate: "2026-09-24", reason: "no_crew" })],
      });
      renderModal();

      expect(screen.getByText("Already marked off")).toBeDefined();
      expect(screen.getByText(/thu, sep 24 · no crew scheduled/i)).toBeDefined();

      fireEvent.click(screen.getByRole("button", { name: "Remove Thu, Sep 24 day off" }));

      await waitFor(() =>
        expect(mockRemoveDayOff).toHaveBeenCalledWith({ id: "nwd-1", projectId: "p1" }),
      );
    });

    it("offers no Remove for a mark older than the editable range", () => {
      mockUseNoWorkDays.mockReturnValue({
        noWorkDays: [markedDay({ offDate: "2026-09-15" })],
      });
      renderModal();

      expect(screen.getByText(/tue, sep 15 · holiday/i)).toBeDefined();
      expect(screen.queryByRole("button", { name: /remove/i })).toBeNull();
    });

    it("keeps the sheet usable when a removal fails", async () => {
      mockRemoveDayOff.mockRejectedValue(new Error("too old"));
      mockUseNoWorkDays.mockReturnValue({ noWorkDays: [markedDay({})] });
      renderModal();

      fireEvent.click(screen.getByRole("button", { name: /remove thu, sep 24 day off/i }));

      await waitFor(() => expect(mockRemoveDayOff).toHaveBeenCalled());
      expect(screen.getByRole("dialog")).toBeDefined();
    });

    it("disables Remove while a removal is in flight", () => {
      mockUseNoWorkDays.mockReturnValue({ noWorkDays: [markedDay({})] });
      mockUseNoWorkDayActions.mockReturnValue({
        markDayOff: mockMarkDayOff,
        removeDayOff: mockRemoveDayOff,
        isMarking: false,
        isRemoving: true,
      });
      renderModal();

      expect(
        (screen.getByRole("button", { name: /remove thu, sep 24 day off/i }) as HTMLButtonElement)
          .disabled,
      ).toBe(true);
    });
  });
});
