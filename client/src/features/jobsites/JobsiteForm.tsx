import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "../../ui_comps/button";
import { Form, FormField, TextInput } from "../../ui_comps/form";
import { Modal } from "../../ui_comps/modal";
import { Select } from "../../ui_comps/select";
import { useCreateJobsite } from "../../hooks/useCreateJobsite";
import { useUpdateJobsite } from "../../hooks/useUpdateJobsite";
import type { Jobsite } from "../../interfaces/jobsite";
import {
  StyledActions,
  StyledUpgradeLink,
  StyledUpgradePrompt,
  StyledUpgradeText,
} from "./styles";

// Mirrors the express-validator chains in server/routes/jobsites.js.
const jobsiteSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Job site name is required")
    .max(120, "Job site name is too long"),
  status: z.enum(["active", "completed"]).optional(),
});

type JobsiteValues = z.infer<typeof jobsiteSchema>;

interface JobsiteFormProps {
  isOpen: boolean;
  onClose: () => void;
  /** Present ⇒ edit mode; absent ⇒ create mode. The manager gives this
   *  component a `key` so it remounts (and re-seeds) when the target changes. */
  jobsite?: Jobsite;
}

/** Create / rename / change-status / archive-restore a GC-owned jobsite.
 *  Archiving is reversible, so it takes no confirm dialog. */
export const JobsiteForm = ({ isOpen, onClose, jobsite }: JobsiteFormProps) => {
  const isEdit = Boolean(jobsite);
  const isArchived = Boolean(jobsite?.archivedAt);
  const { createJobsite, isCreating, planLimitError: createLimitError } = useCreateJobsite();
  const { updateJobsite, isUpdating, planLimitError: updateLimitError } = useUpdateJobsite();
  const planLimitError = createLimitError ?? updateLimitError;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<JobsiteValues>({
    resolver: zodResolver(jobsiteSchema),
    mode: "onTouched",
    defaultValues: {
      name: jobsite?.name ?? "",
      status: jobsite?.status ?? "active",
    },
  });

  const onSubmit = async (values: JobsiteValues) => {
    try {
      if (jobsite) {
        await updateJobsite({
          id: jobsite.id,
          patch: { name: values.name, status: values.status },
        });
      } else {
        await createJobsite({ name: values.name });
      }
      onClose();
    } catch {
      // useCreateJobsite / useUpdateJobsite already surface the failure as a toast.
    }
  };

  // Only rendered in edit mode, so `jobsite` is always present here.
  const handleArchiveToggle = async () => {
    try {
      await updateJobsite({
        id: jobsite!.id,
        patch: { archived: !isArchived },
      });
      onClose();
    } catch {
      // useUpdateJobsite surfaces the failure as a toast.
    }
  };

  const nameId = "jobsite-name";
  const statusId = "jobsite-status";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit job site" : "New job site"}
    >
      {planLimitError && (
        <StyledUpgradePrompt role="alert">
          <StyledUpgradeText>{planLimitError.message}</StyledUpgradeText>
          <StyledUpgradeLink to="/pricing">See plans</StyledUpgradeLink>
        </StyledUpgradePrompt>
      )}

      <Form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField id={nameId} label="Job site name" error={errors.name?.message}>
          <TextInput
            id={nameId}
            type="text"
            placeholder="Riverside Tower"
            hasError={!!errors.name}
            {...register("name")}
          />
        </FormField>

        {/* No error display on Status: it's a bounded Select seeded with a
            valid value, so the Zod enum check can never fail from this UI. */}
        {isEdit && (
          <FormField id={statusId} label="Status">
            <Select
              id={statusId}
              options={[
                { value: "active", label: "Active" },
                { value: "completed", label: "Completed" },
              ]}
              {...register("status")}
            />
          </FormField>
        )}

        <StyledActions>
          {isEdit && (
            <Button
              type="button"
              variant="outline"
              size="md"
              loading={isUpdating}
              onClick={handleArchiveToggle}
            >
              {isArchived ? "Restore" : "Archive"}
            </Button>
          )}
          <Button type="button" variant="outline" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={isCreating || isUpdating}
          >
            {isEdit ? "Save changes" : "Create job site"}
          </Button>
        </StyledActions>
      </Form>
    </Modal>
  );
};
