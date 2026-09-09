import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "../../ui_comps/button";
import { Form, FormField, TextInput } from "../../ui_comps/form";
import { Modal } from "../../ui_comps/modal";
import { Select } from "../../ui_comps/select";
import { useCreateProject } from "../../hooks/useCreateProject";
import { useUpdateProject } from "../../hooks/useUpdateProject";
import type { Project } from "../../interfaces/project";
import { StyledActions } from "./styles";

// Mirrors the express-validator chains in server/routes/projects.js. Only the
// free-text GC name is offered for now — linking a registered GC company waits
// for the invite/join-company flow.
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
  const { createProject, isCreating } = useCreateProject();
  const { updateProject, isUpdating } = useUpdateProject();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProjectValues>({
    resolver: zodResolver(projectSchema),
    mode: "onTouched",
    defaultValues: {
      name: project?.name ?? "",
      gcNameCustom: project?.gcNameCustom ?? "",
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
            status: values.status,
          },
        });
      } else {
        await createProject({
          name: values.name,
          gcNameCustom: values.gcNameCustom,
        });
      }
      onClose();
    } catch {
      // useCreateProject / useUpdateProject already surface the failure as a toast.
    }
  };

  const nameId = "project-name";
  const gcId = "project-gc";
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
        >
          <TextInput
            id={gcId}
            type="text"
            placeholder="Acme Construction"
            hasError={!!errors.gcNameCustom}
            {...register("gcNameCustom")}
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
          >
            {isEdit ? "Save changes" : "Create project"}
          </Button>
        </StyledActions>
      </Form>
    </Modal>
  );
};
