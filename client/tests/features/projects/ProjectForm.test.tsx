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
  useArchiveProject: () => ({
    archiveProject: mockArchive,
    isArchiving: false,
  }),
}));
vi.mock("../../../src/hooks/useDeleteProject", () => ({
  useDeleteProject: () => ({ deleteProject: mockDelete, isDeleting: false }),
}));

const mockUseAuth = vi.fn();
vi.mock("../../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockUseCurrentUser = vi.fn();
vi.mock("../../../src/hooks/useCurrentUser", () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));

const mockUseCurrentCompany = vi.fn();
vi.mock("../../../src/hooks/useCurrentCompany", () => ({
  useCurrentCompany: () => mockUseCurrentCompany(),
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
  gcContactEmail: null,
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
    mockUseAuth.mockReturnValue({ user: { email: "sub@example.com" } });
    mockUseCurrentUser.mockReturnValue({ isGc: false });
    mockUseCurrentCompany.mockReturnValue({ company: null, isLoading: false });
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
        gcContactEmail: null,
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("includes a valid GC contact email when provided", async () => {
    renderForm();

    fireEvent.change(screen.getByLabelText(/project name/i), {
      target: { value: "Downtown Highrise" },
    });
    fireEvent.change(screen.getByLabelText(/general contractor/i), {
      target: { value: "Acme GC" },
    });
    fireEvent.change(screen.getByLabelText(/gc contact email/i), {
      target: { value: "gc@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create project/i }));

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith({
        name: "Downtown Highrise",
        gcNameCustom: "Acme GC",
        gcContactEmail: "gc@example.com",
      }),
    );
  });

  it("shows a validation error for an invalid GC contact email and does not submit", async () => {
    renderForm();

    fireEvent.change(screen.getByLabelText(/project name/i), {
      target: { value: "Downtown Highrise" },
    });
    fireEvent.change(screen.getByLabelText(/general contractor/i), {
      target: { value: "Acme GC" },
    });
    fireEvent.change(screen.getByLabelText(/gc contact email/i), {
      target: { value: "not-an-email" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create project/i }));

    await waitFor(() =>
      expect(screen.getByText(/enter a valid email address/i)).toBeDefined(),
    );
    expect(mockCreate).not.toHaveBeenCalled();
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
          gcContactEmail: null,
          status: "active",
        },
      }),
    );
  });

  it("lets the GC name be edited while the project is not linked to a GC", () => {
    renderForm({ project: editProject });
    expect(
      (screen.getByLabelText(/general contractor/i) as HTMLInputElement)
        .readOnly,
    ).toBe(false);
  });

  it("makes the GC name read-only once the project is linked to a GC", () => {
    renderForm({
      project: { ...editProject, gcCompanyId: "gc-1", gcNameCustom: "Big GC" },
    });
    const input = screen.getByLabelText(
      /general contractor/i,
    ) as HTMLInputElement;
    expect(input.readOnly).toBe(true);
    expect(input.value).toBe("Big GC");
  });

  it("explains why the GC name is read-only when the project is linked, and not otherwise", () => {
    const { unmount } = renderForm({
      project: { ...editProject, gcCompanyId: "gc-1", gcNameCustom: "Big GC" },
    });
    expect(
      screen.getByText(/unlink the project from the list to change it/i),
    ).toBeDefined();
    unmount();

    renderForm({ project: editProject });
    expect(screen.queryByText(/unlink the project from the list/i)).toBeNull();
  });

  it("has no danger zone in create mode", () => {
    renderForm();
    expect(
      screen.queryByRole("button", { name: /archive project/i }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /delete project/i }),
    ).toBeNull();
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

  it("keeps the modal open when archiving fails", async () => {
    const onClose = vi.fn();
    mockArchive.mockRejectedValue(new Error("archive failed"));
    renderForm({ project: editProject, onClose });

    fireEvent.click(screen.getByRole("button", { name: /archive project/i }));

    await waitFor(() =>
      expect(mockArchive).toHaveBeenCalledWith({ id: "p1", archived: true }),
    );
    expect(onClose).not.toHaveBeenCalled();
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

  it("keeps the form open when delete fails after confirmation", async () => {
    const onClose = vi.fn();
    mockDelete.mockRejectedValue(new Error("delete failed"));
    renderForm({ project: editProject, onClose });

    fireEvent.click(screen.getByRole("button", { name: /delete project/i }));
    const confirmButtons = screen.getAllByRole("button", {
      name: /delete project/i,
    });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith("p1"));
    expect(onClose).not.toHaveBeenCalled();
  });

  describe("as a GC creator", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user: { email: "gc@acme.com" } });
      mockUseCurrentUser.mockReturnValue({ isGc: true });
      mockUseCurrentCompany.mockReturnValue({
        company: {
          id: "company-1",
          name: "Acme GC Co",
          companyType: "gc",
          tier: "basic",
          logoPath: null,
        },
        isLoading: false,
      });
    });

    it("prefills and locks the GC name/email fields from the caller's own company and session", () => {
      renderForm();

      const gcNameInput = screen.getByLabelText(
        /general contractor/i,
      ) as HTMLInputElement;
      const gcEmailInput = screen.getByLabelText(
        /gc contact email/i,
      ) as HTMLInputElement;

      expect(gcNameInput.value).toBe("Acme GC Co");
      expect(gcNameInput.readOnly).toBe(true);
      expect(gcEmailInput.value).toBe("gc@acme.com");
      expect(gcEmailInput.readOnly).toBe(true);
      expect(
        screen.getByText(/set from your company profile/i),
      ).toBeDefined();
    });

    it("submits the GC-derived name/email on create", async () => {
      renderForm();

      fireEvent.change(screen.getByLabelText(/project name/i), {
        target: { value: "Downtown Highrise" },
      });
      fireEvent.click(screen.getByRole("button", { name: /create project/i }));

      await waitFor(() =>
        expect(mockCreate).toHaveBeenCalledWith({
          name: "Downtown Highrise",
          gcNameCustom: "Acme GC Co",
          gcContactEmail: "gc@acme.com",
        }),
      );
    });

    it("overrides a previously-stored GC name/email in edit mode", () => {
      renderForm({ project: editProject });

      const gcNameInput = screen.getByLabelText(
        /general contractor/i,
      ) as HTMLInputElement;
      expect(gcNameInput.value).toBe("Acme GC Co");
      expect(gcNameInput.value).not.toBe(editProject.gcNameCustom);
    });

    it("disables submit while the caller's own company is still loading", () => {
      mockUseCurrentCompany.mockReturnValue({ company: null, isLoading: true });
      renderForm();

      expect(
        screen.getByRole("button", { name: /create project/i }),
      ).toHaveProperty("disabled", true);
    });
  });
});
