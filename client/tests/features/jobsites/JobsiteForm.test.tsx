import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { MemoryRouter } from "react-router-dom";

import { JobsiteForm } from "../../../src/features/jobsites/JobsiteForm";
import theme from "../../../src/styles/theme";
import type { Jobsite } from "../../../src/interfaces/jobsite";
import { PlanLimitError } from "../../../src/utils/PlanLimitError";

const mockCreate = vi.fn();
const mockUpdate = vi.fn();
let createLimitError: Error | null = null;
let updateLimitError: Error | null = null;

vi.mock("../../../src/hooks/useCreateJobsite", () => ({
  useCreateJobsite: () => ({
    createJobsite: mockCreate,
    isCreating: false,
    planLimitError: createLimitError,
  }),
}));
vi.mock("../../../src/hooks/useUpdateJobsite", () => ({
  useUpdateJobsite: () => ({
    updateJobsite: mockUpdate,
    isUpdating: false,
    planLimitError: updateLimitError,
  }),
}));

const jobsite: Jobsite = {
  id: "j1",
  gcCompanyId: "gc-1",
  name: "Riverside",
  status: "active",
  archivedAt: null,
  createdBySub: false,
  plan: "free",
  meetingCadence: "daily",
  createdAt: "x",
  subcontractors: [],
};

const renderForm = (
  props: Partial<React.ComponentProps<typeof JobsiteForm>> = {},
) =>
  render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <JobsiteForm isOpen onClose={vi.fn()} {...props} />
      </ThemeProvider>
    </MemoryRouter>,
  );

describe("JobsiteForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createLimitError = null;
    updateLimitError = null;
    mockCreate.mockResolvedValue(undefined);
    mockUpdate.mockResolvedValue(undefined);
  });

  it("renders nothing when closed", () => {
    renderForm({ isOpen: false });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("creates a jobsite with the trimmed name and closes", async () => {
    const onClose = vi.fn();
    renderForm({ onClose });

    expect(screen.getByText("New job site")).toBeDefined();
    expect(screen.queryByLabelText(/status/i)).toBeNull();
    fireEvent.change(screen.getByLabelText(/job site name/i), {
      target: { value: "  Riverside  " },
    });
    fireEvent.click(screen.getByRole("button", { name: /create job site/i }));

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith({ name: "Riverside" }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("requires a name and does not submit without one", async () => {
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: /create job site/i }));

    expect(await screen.findByText(/job site name is required/i)).toBeDefined();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("stays open when creating fails (the hook already toasts)", async () => {
    mockCreate.mockRejectedValue(new Error("nope"));
    const onClose = vi.fn();
    renderForm({ onClose });

    fireEvent.change(screen.getByLabelText(/job site name/i), {
      target: { value: "Riverside" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create job site/i }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onPlanLimit when creating hits the plan's site cap", async () => {
    mockCreate.mockRejectedValue(new PlanLimitError("Site cap", 1));
    const onPlanLimit = vi.fn();
    renderForm({ onPlanLimit });

    fireEvent.change(screen.getByLabelText(/job site name/i), {
      target: { value: "Riverside" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create job site/i }));

    await waitFor(() => expect(onPlanLimit).toHaveBeenCalledTimes(1));
  });

  it("does not call onPlanLimit for a plan-limit error while editing", async () => {
    mockUpdate.mockRejectedValue(new PlanLimitError("Site cap", 1));
    const onPlanLimit = vi.fn();
    renderForm({ jobsite, onPlanLimit });

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(onPlanLimit).not.toHaveBeenCalled();
  });

  it("prefills and saves an edit with name and status", async () => {
    const onClose = vi.fn();
    renderForm({ jobsite, onClose });

    expect(screen.getByText("Edit job site")).toBeDefined();
    expect(
      (screen.getByLabelText(/job site name/i) as HTMLInputElement).value,
    ).toBe("Riverside");
    fireEvent.change(screen.getByLabelText(/job site name/i), {
      target: { value: "Riverside Tower" },
    });
    fireEvent.change(screen.getByLabelText(/status/i), {
      target: { value: "completed" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith({
        id: "j1",
        patch: { name: "Riverside Tower", status: "completed", meetingCadence: "daily" },
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("saves a changed meeting cadence in edit mode and hides the control when creating", async () => {
    renderForm({ jobsite });

    fireEvent.change(screen.getByLabelText(/safety talk cadence/i), {
      target: { value: "weekly" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith({
        id: "j1",
        patch: { name: "Riverside", status: "active", meetingCadence: "weekly" },
      }),
    );
  });

  it("does not show the cadence control when creating", () => {
    renderForm();

    expect(screen.queryByLabelText(/safety talk cadence/i)).toBeNull();
  });

  it("stays open when saving an edit fails", async () => {
    mockUpdate.mockRejectedValue(new Error("nope"));
    const onClose = vi.fn();
    renderForm({ jobsite, onClose });

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
  });

  it("archives an active jobsite and closes", async () => {
    const onClose = vi.fn();
    renderForm({ jobsite, onClose });

    fireEvent.click(screen.getByRole("button", { name: /^archive$/i }));

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith({
        id: "j1",
        patch: { archived: true },
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("restores an archived jobsite", async () => {
    renderForm({ jobsite: { ...jobsite, archivedAt: "2026-09-02" } });

    fireEvent.click(screen.getByRole("button", { name: /^restore$/i }));

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith({
        id: "j1",
        patch: { archived: false },
      }),
    );
  });

  it("stays open when archiving fails", async () => {
    mockUpdate.mockRejectedValue(new Error("nope"));
    const onClose = vi.fn();
    renderForm({ jobsite, onClose });

    fireEvent.click(screen.getByRole("button", { name: /^archive$/i }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows an upgrade prompt when creating hits the plan's job site cap", () => {
    createLimitError = new Error("Your plan's job site limit is reached.");
    renderForm();

    expect(screen.getByRole("alert").textContent).toMatch(/job site limit is reached/i);
    expect(
      screen.getByRole("link", { name: /see plans/i }).getAttribute("href"),
    ).toBe("/pricing");
  });

  it("shows the same upgrade prompt when restoring hits the cap", () => {
    updateLimitError = new Error("Your plan's job site limit is reached.");
    renderForm({ jobsite: { ...jobsite, archivedAt: "2026-09-02" } });

    expect(screen.getByRole("alert")).toBeDefined();
  });

  it("shows no upgrade prompt by default", () => {
    renderForm();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("closes from Cancel", () => {
    const onClose = vi.fn();
    renderForm({ onClose });

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
