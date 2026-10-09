import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "../../ui_comps/button";
import { Form, FormField, TextInput } from "../../ui_comps/form";
import { Modal } from "../../ui_comps/modal";
import { useInHouseCrewActions } from "../../hooks/useInHouseCrews";
import type { InHouseCrew } from "../../interfaces/inHouseCrew";
import { StyledActions } from "./styles";

const renameSchema = z.object({
  name: z.string().trim().min(1, "Crew name is required").max(120, "Crew name is too long"),
});

type RenameValues = z.infer<typeof renameSchema>;

interface CrewRenameModalProps {
  crew: InHouseCrew;
  onClose: () => void;
}

/** Renames one crew. The caller mounts it only while a crew is selected, so
 *  the form always starts from that crew's current name. */
export const CrewRenameModal = ({ crew, onClose }: CrewRenameModalProps) => {
  const { updateCrew, isUpdating } = useInHouseCrewActions();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RenameValues>({
    resolver: zodResolver(renameSchema),
    mode: "onTouched",
    defaultValues: { name: crew.name },
  });

  const onSubmit = async (values: RenameValues) => {
    try {
      await updateCrew({ id: crew.id, patch: { name: values.name } });
      onClose();
    } catch {
      // useInHouseCrewActions already surfaces the failure as a toast.
    }
  };

  const nameId = "crew-rename";

  return (
    <Modal isOpen onClose={onClose} title="Rename crew">
      <Form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField id={nameId} label="Crew name" error={errors.name?.message}>
          <TextInput id={nameId} type="text" hasError={!!errors.name} {...register("name")} />
        </FormField>
        <StyledActions>
          <Button type="button" variant="outline" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md" loading={isUpdating}>
            Save
          </Button>
        </StyledActions>
      </Form>
    </Modal>
  );
};
