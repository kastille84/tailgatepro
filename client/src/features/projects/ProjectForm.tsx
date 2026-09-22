import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { useAuth } from "../../context/auth";
import { Button } from "../../ui_comps/button";
import { ConfirmDialog } from "../../ui_comps/confirm-dialog";
import { Form, FormField, TextInput } from "../../ui_comps/form";
import { Modal } from "../../ui_comps/modal";
import { Select } from "../../ui_comps/select";
import { useCreateProject } from "../../hooks/useCreateProject";
import { useUpdateProject } from "../../hooks/useUpdateProject";
import { useArchiveProject } from "../../hooks/useArchiveProject";
import { useDeleteProject } from "../../hooks/useDeleteProject";
import { useCurrentCompany } from "../../hooks/useCurrentCompany";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import type { Project } from "../../interfaces/project";
import {
  StyledActions,
  StyledDangerZone,
  StyledDangerZoneTitle,
} from "./styles";

// Mirrors the express-validator chains in server/routes/projects.js. The GC
// name is free text; linking a registered GC company is a separate action
// ("Link to GC" on the project list → GcLinkModal), which overwrites the name
// with the GC's registered one. When the creator is themselves a GC, they
// *are* the GC these fields describe, so the form derives and locks them
// from the caller's own company/session instead (see isGc below).
const projectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Project name is required")
    .max(120, "Project name is too long"),
  gcNameCustom: z
    .string()
    .trim()
    .min(1, "Enter the general contractor for this project")
    .max(120, "GC name is too long"),
  // Optional: RHF's native text input always yields a string, never
  // `undefined`, so `.or(z.literal(""))` is what makes this genuinely
  // optional — `.optional()` alone only skips `undefined`.
  gcContactEmail: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .or(z.literal("")),
  status: z.enum(["active", "completed"]).optional(),
});

type ProjectValues = z.infer<typeof projectSchema>;

interface ProjectFormProps {
  isOpen: boolean;
  onClose: () => void;
  /** Present ⇒ edit mode; absent ⇒ create mode. The page gives this component a
   *  `key` so it remounts (and re-seeds `defaultValues`) when the target changes. */
  project?: Project;
}

export const ProjectForm = ({ isOpen, onClose, project }: ProjectFormProps) => {
  const isEdit = Boolean(project);
  const isArchived = Boolean(project?.archivedAt);
  const isGcLinked = Boolean(project?.gcCompanyId);
  const { createProject, isCreating } = useCreateProject();
  const { updateProject, isUpdating } = useUpdateProject();
  const { archiveProject, isArchiving } = useArchiveProject();
  const { deleteProject, isDeleting } = useDeleteProject();

  // A GC creating/editing their own project *is* the GC these fields
  // describe, so derive and lock them instead of asking for a retyped copy.
  const { isGc } = useCurrentUser();
  const { user } = useAuth();
  const { company, isLoading: isCompanyLoading } = useCurrentCompany();
  const isGcFieldLocked = isGc || isGcLinked;

  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const handleArchiveToggle = async () => {
    if (!project) return;
    try {
      await archiveProject({ id: project.id, archived: !isArchived });
      onClose();
    } catch {
      // useArchiveProject surfaces the failure as a toast.
    }
  };

  const handleDelete = async () => {
    if (!project) return;
    try {
      await deleteProject(project.id);
      setIsConfirmingDelete(false);
      onClose();
    } catch {
      // useDeleteProject surfaces the failure (incl. the 409 "archive instead").
      setIsConfirmingDelete(false);
    }
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProjectValues>({
    resolver: zodResolver(projectSchema),
    mode: "onTouched",
    // `values` (not `defaultValues`) so the GC-derived fields sync once the
    // company/session data finishes loading, instead of being frozen blank
    // at whatever they were on first mount.
    values: {
      name: project?.name ?? "",
      gcNameCustom: isGc ? (company?.name ?? "") : (project?.gcNameCustom ?? ""),
      gcContactEmail: isGc
        ? (user?.email ?? "")
        : (project?.gcContactEmail ?? ""),
      status: project?.status ?? "active",
    },
  });

  const onSubmit = async (values: ProjectValues) => {
    try {
      if (project) {
        await updateProject({
          id: project.id,
          patch: {
            name: values.name,
            gcNameCustom: values.gcNameCustom,
            gcContactEmail: values.gcContactEmail || null,
            status: values.status,
          },
        });
      } else {
        await createProject({
          name: values.name,
          gcNameCustom: values.gcNameCustom,
          gcContactEmail: values.gcContactEmail || null,
        });
      }
      onClose();
    } catch {
      // useCreateProject / useUpdateProject already surface the failure as a toast.
    }
  };

  const nameId = "project-name";
  const gcId = "project-gc";
  const gcContactEmailId = "project-gc-email";
  const statusId = "project-status";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit project" : "New project"}
    >
      <Form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField id={nameId} label="Project name" error={errors.name?.message}>
          <TextInput
            id={nameId}
            type="text"
            placeholder="Downtown Highrise"
            hasError={!!errors.name}
            {...register("name")}
          />
        </FormField>

        <FormField
          id={gcId}
          label="General contractor"
          error={errors.gcNameCustom?.message}
          hint={
            isGc
              ? "You're the general contractor on this project — set from your company profile."
              : isGcLinked
                ? "Linked to a general contractor — this is their registered name. Unlink the project from the list to change it."
                : undefined
          }
        >
          <TextInput
            id={gcId}
            type="text"
            placeholder={
              isGc && isCompanyLoading ? "Loading…" : "Acme Construction"
            }
            // Once linked (or when the creator is themselves the GC), this
            // holds the GC's registered name; editing it would drift from
            // the source of truth. Unlink from the list to change it.
            readOnly={isGcFieldLocked}
            hasError={!!errors.gcNameCustom}
            {...register("gcNameCustom")}
          />
        </FormField>

        <FormField
          id={gcContactEmailId}
          label={isGc ? "GC contact email" : "GC contact email (optional)"}
          error={errors.gcContactEmail?.message}
          hint={isGc ? "Set from your account email." : undefined}
        >
          <TextInput
            id={gcContactEmailId}
            type="email"
            placeholder={
              isGc && isCompanyLoading ? "Loading…" : "gc@example.com"
            }
            readOnly={isGc}
            hasError={!!errors.gcContactEmail}
            {...register("gcContactEmail")}
          />
        </FormField>

        {isEdit && (
          <FormField id={statusId} label="Status" error={errors.status?.message}>
            <Select
              id={statusId}
              hasError={!!errors.status}
              options={[
                { value: "active", label: "Active" },
                { value: "completed", label: "Completed" },
              ]}
              {...register("status")}
            />
          </FormField>
        )}

        <StyledActions>
          <Button type="button" variant="outline" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={isCreating || isUpdating}
            disabled={isGc && isCompanyLoading}
          >
            {isEdit ? "Save changes" : "Create project"}
          </Button>
        </StyledActions>
      </Form>

      {isEdit && (
        <StyledDangerZone>
          <StyledDangerZoneTitle>Danger zone</StyledDangerZoneTitle>
          <Button
            type="button"
            variant="outline"
            size="md"
            loading={isArchiving}
            onClick={handleArchiveToggle}
          >
            {isArchived ? "Restore project" : "Archive project"}
          </Button>
          <Button
            type="button"
            variant="danger"
            size="md"
            onClick={() => setIsConfirmingDelete(true)}
          >
            Delete project
          </Button>
        </StyledDangerZone>
      )}

      <ConfirmDialog
        isOpen={isConfirmingDelete}
        title="Delete project"
        confirmLabel="Delete project"
        confirmVariant="danger"
        isBusy={isDeleting}
        onConfirm={handleDelete}
        onClose={() => setIsConfirmingDelete(false)}
      >
        Delete <strong>{project?.name}</strong>? This can't be undone. If the
        project has logged safety talks, archive it instead — those OSHA records
        must be kept.
      </ConfirmDialog>
    </Modal>
  );
};
