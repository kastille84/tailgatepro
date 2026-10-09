import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "styled-components";

import { CrewForm } from "../../../src/features/in-house-crews/CrewForm";
import { PlanLimitError } from "../../../src/utils/PlanLimitError";
import theme from "../../../src/styles/theme";

const mockUseOnlineStatus = vi.fn();
const mockUseCurrentCompany = vi.fn();
const mockUseActions = vi.fn();
const mockCreateCrew = vi.fn();
const mockUseJobsites = vi.fn();

vi.mock("../../../src/context/online-status", () => ({
  useOnlineStatus: () => mockUseOnlineStatus(),
}));
vi.mock("../../../src/hooks/useCurrentCompany", () => ({
  useCurrentCompany: () => mockUseCurrentCompany(),
}));
vi.mock("../../../src/hooks/useInHouseCrews", () => ({
  useInHouseCrewActions: () => mockUseActions(),
}));
vi.mock("../../../src/hooks/useJobsites", () => ({
  useJobsites: () => mockUseJobsites(),
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

const renderForm = (onClose = vi.fn()) => {
  render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <CrewForm isOpen onClose={onClose} />
      </ThemeProvider>
    </MemoryRouter>,
  );
  return onClose;
};

const nameInput = () => screen.getByLabelText(/crew name/i) as HTMLInputElement;

describe("CrewForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOnlineStatus.mockReturnValue({ isOnline: true });
    mockUseCurrentCompany.mockReturnValue({ company: { name: "Hyperion" } });
    mockCreateCrew.mockResolvedValue({ id: "c1", name: "Hyperion - Framing" });
    mockUseJobsites.mockReturnValue({ jobsites: [] });
    mockUseActions.mockReturnValue({
      createCrew: mockCreateCrew,
      isCreating: false,
      createPlanLimitError: null,
    });
  });

  it("offers the six trades plus Other", () => {
    renderForm();

    ["Framing", "Roofing", "Concrete", "Electrical", "Plumbing", "Drywall", "Other"].forEach(
      (trade) => expect(screen.getByRole("button", { name: trade })).toBeDefined(),
    );
  });

  it("prefills the name from a trade chip", () => {
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: "Roofing" }));

    expect(nameInput().value).toBe("Hyperion - Roofing");
  });

  it("lets Other prefill the dash and focus the input so any trade can be typed", async () => {
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: "Other" }));
    expect(nameInput().value).toBe("Hyperion - ");
    // RHF's setFocus focuses on a timeout.
    await waitFor(() => expect(document.activeElement).toBe(nameInput()));

    fireEvent.change(nameInput(), { target: { value: "Hyperion - Masonry" } });
    fireEvent.click(screen.getByRole("button", { name: "Add crew" }));

    await waitFor(() =>
      expect(mockCreateCrew).toHaveBeenCalledWith({ name: "Hyperion - Masonry", jobsiteIds: [] }),
    );
  });

  it("falls back to an empty prefix until the company has loaded", () => {
    mockUseCurrentCompany.mockReturnValue({ company: null });
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: "Framing" }));

    expect(nameInput().value).toBe("Framing");
  });

  it("creates the crew, then offers to invite its foreman instead of closing", async () => {
    const onClose = renderForm();

    fireEvent.change(nameInput(), { target: { value: "  Hyperion - Framing  " } });
    fireEvent.click(screen.getByRole("button", { name: "Add crew" }));

    await waitFor(() =>
      expect(mockCreateCrew).toHaveBeenCalledWith({ name: "Hyperion - Framing", jobsiteIds: [] }),
    );
    expect(await screen.findByRole("dialog", { name: "Crew added" })).toBeDefined();
    expect(screen.getByText(/nobody can log in as this crew until you invite them/i)).toBeDefined();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("opens the invite for the new crew from Invite someone, and closes when it does", async () => {
    const onClose = renderForm();

    fireEvent.change(nameInput(), { target: { value: "Hyperion - Framing" } });
    fireEvent.click(screen.getByRole("button", { name: "Add crew" }));
    fireEvent.click(await screen.findByRole("button", { name: "Invite someone" }));

    expect(screen.getByText("stub-invite Hyperion - Framing")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "stub-invite-close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes from Later without inviting", async () => {
    const onClose = renderForm();

    fireEvent.change(nameInput(), { target: { value: "Hyperion - Framing" } });
    fireEvent.click(screen.getByRole("button", { name: "Add crew" }));
    fireEvent.click(await screen.findByRole("button", { name: "Later" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the form open and clears the name on Add another", async () => {
    const onClose = renderForm();

    fireEvent.change(nameInput(), { target: { value: "Hyperion - Framing" } });
    fireEvent.click(screen.getByRole("button", { name: "Add another" }));

    await waitFor(() => expect(mockCreateCrew).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(nameInput().value).toBe(""));
    expect(onClose).not.toHaveBeenCalled();
  });

  describe("job sites", () => {
    const site = (id: string, name: string, overrides = {}) => ({
      id,
      name,
      status: "active",
      archivedAt: null,
      ...overrides,
    });

    beforeEach(() => {
      mockUseJobsites.mockReturnValue({
        jobsites: [
          site("s1", "Riverside Tower"),
          site("s2", "Harbor Lofts"),
          site("s3", "Finished Site", { status: "completed" }),
          site("s4", "Old Site", { archivedAt: "2026-01-01" }),
        ],
      });
    });

    it("lists only live job sites, all pre-ticked", () => {
      renderForm();

      expect((screen.getByLabelText("Riverside Tower") as HTMLInputElement).checked).toBe(true);
      expect((screen.getByLabelText("Harbor Lofts") as HTMLInputElement).checked).toBe(true);
      expect(screen.queryByLabelText("Finished Site")).toBeNull();
      expect(screen.queryByLabelText("Old Site")).toBeNull();
    });

    it("attaches the crew only to the sites left ticked", async () => {
      renderForm();

      fireEvent.click(screen.getByLabelText("Harbor Lofts"));
      fireEvent.change(nameInput(), { target: { value: "Hyperion - Roofing" } });
      fireEvent.click(screen.getByRole("button", { name: "Add crew" }));

      await waitFor(() =>
        expect(mockCreateCrew).toHaveBeenCalledWith({
          name: "Hyperion - Roofing",
          jobsiteIds: ["s1"],
        }),
      );
    });

    it("lets an unticked site be ticked again", async () => {
      renderForm();

      fireEvent.click(screen.getByLabelText("Harbor Lofts"));
      fireEvent.click(screen.getByLabelText("Harbor Lofts"));
      fireEvent.change(nameInput(), { target: { value: "Hyperion - Roofing" } });
      fireEvent.click(screen.getByRole("button", { name: "Add crew" }));

      await waitFor(() =>
        expect(mockCreateCrew).toHaveBeenCalledWith({
          name: "Hyperion - Roofing",
          jobsiteIds: ["s1", "s2"],
        }),
      );
    });

    it("disables the choices while offline", () => {
      mockUseOnlineStatus.mockReturnValue({ isOnline: false });
      renderForm();

      expect((screen.getByLabelText("Riverside Tower") as HTMLInputElement).disabled).toBe(true);
    });
  });

  it("closes from Done without saving", () => {
    const onClose = renderForm();

    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(onClose).toHaveBeenCalled();
    expect(mockCreateCrew).not.toHaveBeenCalled();
  });

  it("requires a name", async () => {
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: "Add crew" }));

    expect(await screen.findByText("Crew name is required")).toBeDefined();
    expect(mockCreateCrew).not.toHaveBeenCalled();
  });

  it("rejects the bare Other prefill, which has no trade after the dash", async () => {
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: "Other" }));
    fireEvent.click(screen.getByRole("button", { name: "Add crew" }));

    expect(await screen.findByText("Add the trade after the dash")).toBeDefined();
    expect(mockCreateCrew).not.toHaveBeenCalled();
  });

  it("rejects a name over 120 characters", async () => {
    renderForm();

    fireEvent.change(nameInput(), { target: { value: "a".repeat(121) } });
    fireEvent.click(screen.getByRole("button", { name: "Add crew" }));

    expect(await screen.findByText("Crew name is too long")).toBeDefined();
  });

  it("stays open when the server rejects the crew", async () => {
    mockCreateCrew.mockRejectedValue(new Error("duplicate"));
    const onClose = renderForm();

    fireEvent.change(nameInput(), { target: { value: "Hyperion - Framing" } });
    fireEvent.click(screen.getByRole("button", { name: "Add crew" }));

    await waitFor(() => expect(mockCreateCrew).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
    expect(nameInput().value).toBe("Hyperion - Framing");
  });

  it("shows the upgrade prompt on a plan-limit rejection", () => {
    mockUseActions.mockReturnValue({
      createCrew: mockCreateCrew,
      isCreating: false,
      createPlanLimitError: new PlanLimitError("Crew limit reached", 1),
    });
    renderForm();

    expect(screen.getByRole("alert").textContent).toContain("Crew limit reached");
    expect(screen.getByRole("link", { name: /see plans/i }).getAttribute("href")).toBe("/pricing");
  });

  it("explains and disables saving while offline", () => {
    mockUseOnlineStatus.mockReturnValue({ isOnline: false });
    renderForm();

    expect(screen.getByRole("status").textContent).toMatch(/you're offline/i);
    expect((screen.getByRole("button", { name: "Add crew" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(nameInput().disabled).toBe(true);
  });
});
