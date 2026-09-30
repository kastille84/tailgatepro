import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { ProjectCadenceControl } from "../../../src/features/projects/ProjectCadenceControl";
import theme from "../../../src/styles/theme";
import type { JobsiteMembership } from "../../../src/interfaces/jobsite";

const mockSetMyCadence = vi.fn();

vi.mock("../../../src/hooks/useSetMyCadence", () => ({
  useSetMyCadence: () => ({ setMyCadence: mockSetMyCadence, isSaving: false }),
}));

const weekly: JobsiteMembership = {
  jobsiteId: "j1",
  jobsiteName: "Riverside",
  jobsiteCadence: "weekly",
  subCadence: null,
  effectiveCadence: "weekly",
};
const daily: JobsiteMembership = {
  jobsiteId: "j2",
  jobsiteName: "North Site",
  jobsiteCadence: "daily",
  subCadence: null,
  effectiveCadence: "daily",
};

const renderControl = (membership: JobsiteMembership) =>
  render(
    <ThemeProvider theme={theme}>
      <ProjectCadenceControl membership={membership} />
    </ThemeProvider>,
  );

describe("ProjectCadenceControl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetMyCadence.mockResolvedValue(undefined);
  });

  it("lets a sub tighten a weekly job site to daily", async () => {
    renderControl(weekly);

    expect(screen.getByText("Talk cadence")).toBeDefined();
    expect(screen.getByText(/your gc requires weekly/i)).toBeDefined();
    fireEvent.change(screen.getByLabelText("Talk cadence for Riverside"), {
      target: { value: "daily" },
    });

    await waitFor(() =>
      expect(mockSetMyCadence).toHaveBeenCalledWith({ jobsiteId: "j1", cadence: "daily" }),
    );
  });

  it("clears the override when the GC default is picked again", async () => {
    renderControl({ ...weekly, subCadence: "daily", effectiveCadence: "daily" });

    fireEvent.change(screen.getByLabelText("Talk cadence for Riverside"), {
      target: { value: "" },
    });

    await waitFor(() =>
      expect(mockSetMyCadence).toHaveBeenCalledWith({ jobsiteId: "j1", cadence: null }),
    );
  });

  it("fixes the control on a daily job site, since nothing is tighter", () => {
    renderControl(daily);

    const select = screen.getByLabelText("Talk cadence for North Site") as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    expect(screen.getByText("Your GC requires daily.")).toBeDefined();
  });

  it("swallows a failed save (the hook already toasts)", async () => {
    mockSetMyCadence.mockRejectedValue(new Error("nope"));
    renderControl(weekly);

    fireEvent.change(screen.getByLabelText("Talk cadence for Riverside"), {
      target: { value: "daily" },
    });

    await waitFor(() => expect(mockSetMyCadence).toHaveBeenCalled());
  });
});
