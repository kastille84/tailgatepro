import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "../../ui_comps/button";
import { Form, FormField, TextInput } from "../../ui_comps/form";
import { useOnlineStatus } from "../../context/online-status";
import { useInviteSubcontractor } from "../../hooks/useInviteSubcontractor";

// Mirrors the validator in server/routes/jobsites.js's POST /:id/invite chain.
const inviteSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
});

type InviteValues = z.infer<typeof inviteSchema>;

interface InviteSubcontractorFormProps {
  jobsiteId: string;
}

/** Invite a subcontractor to one jobsite by email (Phase 8d). Online-only —
 *  the server sends the email — so offline disables the form. */
export const InviteSubcontractorForm = ({
  jobsiteId,
}: InviteSubcontractorFormProps) => {
  const { isOnline } = useOnlineStatus();
  const { inviteSubcontractor, isInviting } = useInviteSubcontractor();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    mode: "onTouched",
    defaultValues: { email: "" },
  });

  const emailId = "invite-subcontractor-email";

  const onSubmit = async ({ email }: InviteValues) => {
    try {
      await inviteSubcontractor({ jobsiteId, email });
      reset({ email: "" });
    } catch {
      // useInviteSubcontractor already surfaces the failure as a toast.
    }
  };

  return (
    <Form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FormField
        id={emailId}
        label="Subcontractor email"
        error={errors.email?.message}
      >
        <TextInput
          id={emailId}
          type="email"
          autoComplete="off"
          placeholder="foreman@subcontractor.com"
          disabled={!isOnline}
          hasError={!!errors.email}
          {...register("email")}
        />
      </FormField>

      <Button
        type="submit"
        variant="primary"
        size="md"
        loading={isInviting}
        disabled={!isOnline}
      >
        Send invite
      </Button>
    </Form>
  );
};
