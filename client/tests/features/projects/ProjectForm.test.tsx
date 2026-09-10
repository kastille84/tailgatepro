import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { ProjectForm } from "../../../src/features/projects";
import theme from "../../../src/styles/theme";
import type { Project } from "../../../src/interfaces/project";

const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockArchive = vi.fn();
const mockDelete = vi.fn();

vi.mock("../../../src/hooks/useCreateProject", () => ({
  useCreateProject: () => ({ createProject: mockCreate, isCreating: false }),
}));
vi.mock("../../../src/hooks/useUpdateProject", () => ({
  useUpdateProject: () => ({ updateProject: mockUpdate, isUpdating: false }),
}));
vi.mock("../../../src/hooks/useArchiveProject", () => ({
  useArchiveProject: () => ({ archiveProject: mockArchive, isArchiving: false }),
}));
vi.mock("../../../src/hooks/useDeleteProject", () => ({
  useDeleteProject: () => ({ deleteProject: mockDelete, isDeleting: false }),
}));

const renderForm = (
  props: Partial<React.ComponentProps<typeof ProjectForm>> = {},
) =>
  render(
    <ThemeProvider theme={theme}>
      <ProjectForm isOpen onClose={vi.fn()} {...props} />
    </ThemeProvider>,
  );

const editProject: Project = {
  id: "p1",
  ownerCompanyId: "c1",
  name: "Old Name",
  gcCompanyId: null,
  gcNameCustom: "Old GC",
  status: "active",
  archivedAt: null,
  createdAt: "x",
};

describe("ProjectForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue(undefined);
    mockUpdate.mockResolvedValue(undefined);
    mockArchive.mockResolvedValue(undefined);
    mockDelete.mockResolvedValue(undefined);
  });

  it("renders nothing when closed", () => {
    renderForm({ isOpen: false });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("creates a project and closes on a valid submit", async () => {
    const onClose = vi.fn();
    renderForm({ onClose });

    expect(screen.getByText("New project")).toBeDefined();
    fireEvent.change(screen.getByLabelText(/project name/i), {
      target: { value: "Downtown Highrise" },
    });
    fireEvent.change(screen.getByLabelText(/general contractor/i), {
      target: { value: "Acme GC" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create project/i }));

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith({
        name: "Downtown Highrise",
        gcNameCustom: "Acme GC",
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("shows validation errors and does not submit when fields are empty", async () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: /create project/i }));

    await waitFor(() =>
      expect(screen.getByText(/project name is required/i)).toBeDefined(),
    );
    expect(screen.getByText(/enter the general contractor/i)).toBeDefined();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("keeps the modal open when the mutation rejects", async () => {
    const onClose = vi.fn();
    mockCreate.mockRejectedValue(new Error("This project already exists"));
    renderForm({ onClose });

    fireEvent.change(screen.getByLabelText(/project name/i), {
      target: { value: "Dupe" },
    });
    fireEvent.change(screen.getByLabelText(/general contractor/i), {
      target: { value: "Acme GC" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create project/i }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
  });

  it("pre-fills fields and patches with the id in edit mode", async () => {
    renderForm({ project: editProject });

    expect(screen.getByText("Edit project")).toBeDefined();
    expect(
      (screen.getByLabelText(/project name/i) as HTMLInputElement).value,
    ).toBe("Old Name");
    expect(screen.getByLabelText(/status/i)).toBeDefined();

    fireEvent.change(screen.getByLabelText(/project name/i), {
      target: { value: "New Name" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith({
        id: "p1",
        patch: {
          name: "New Name",
          gcNameCustom: "Old GC",
          status: "active",
        },
      }),
    );
  });

  it("has no danger zone in create mode", () => {
    renderForm();
    expect(
      screen.queryByRole("button", { name: /archive project/i }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /delete project/i })).toBeNull();
  });

  it("archives the project and closes when Archive is clicked in edit mode", async () => {
    const onClose = vi.fn();
    renderForm({ project: editProject, onClose });

    fireEvent.click(screen.getByRole("button", { name: /archive project/i }));

    await waitFor(() =>
      expect(mockArchive).toHaveBeenCalledWith({ id: "p1", archived: true }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("offers Restore instead of Archive for an already-archived project", async () => {
    renderForm({
      project: { ...editProject, archivedAt: "2026-09-09T00:00:00.000Z" },
    });

    fireEvent.click(screen.getByRole("button", { name: /restore project/i }));

    await waitFor(() =>
      expect(mockArchive).toHaveBeenCalledWith({ id: "p1", archived: false }),
    );
  });

  it("deletes only after the confirm dialog is confirmed", async () => {
    const onClose = vi.fn();
    renderForm({ project: editProject, onClose });

    // Opening the danger-zone Delete button does not delete on its own.
    fireEvent.click(screen.getByRole("button", { name: /delete project/i }));
    expect(mockDelete).not.toHaveBeenCalled();

    // The confirm dialog's own confirm button does.
    const confirmButtons = screen.getAllByRole("button", {
      name: /delete project/i,
    });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith("p1"));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
