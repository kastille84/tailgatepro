import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "../../ui_comps/button";
import { Form, FormField, TextInput } from "../../ui_comps/form";
import { Modal } from "../../ui_comps/modal";
import { Select, type SelectOption } from "../../ui_comps/select";
import { useOnlineStatus } from "../../context/online-status";
import { useInHouseCrewActions } from "../../hooks/useInHouseCrews";
import type { CrewInviteRole, InHouseCrew } from "../../interfaces/inHouseCrew";
import {
  StyledActions,
  StyledNote,
  StyledUpgradeLink,
  StyledUpgradePrompt,
  StyledUpgradeText,
} from "./styles";

// Superintendent is deliberately absent: it is a GC Portfolio-only role and a
// crew is a subcontractor company (server/routes/companies.js).
const ROLE_OPTIONS: SelectOption[] = [
  { value: "foreman", label: "Foreman" },
  { value: "safety_manager", label: "Safety Director" },
  { value: "admin", label: "Admin" },
];

const inviteSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  role: z.enum(["admin", "safety_manager", "foreman"]),
});

type InviteValues = z.infer<typeof inviteSchema>;

interface CrewInviteModalProps {
  crew: InHouseCrew;
  onClose: () => void;
}

/** Invites a person into one crew by email (Phase 13d). They sign up through
 *  the usual invite link and land in the crew's company, not the GC's. */
export const CrewInviteModal = ({ crew, onClose }: CrewInviteModalProps) => {
  const { isOnline } = useOnlineStatus();
  const { inviteCrewMember, isInviting, invitePlanLimitError } = useInHouseCrewActions();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    mode: "onTouched",
    defaultValues: { email: "", role: "foreman" },
  });

  const onSubmit = async (values: InviteValues) => {
    try {
      await inviteCrewMember({
        crewId: crew.id,
        email: values.email,
        role: values.role as CrewInviteRole,
      });
      onClose();
    } catch {
      // useInHouseCrewActions already surfaces the failure as a toast / inline prompt.
    }
  };

  const emailId = "crew-invite-email";
  const roleId = "crew-invite-role";

  return (
    <Modal isOpen onClose={onClose} title={`Invite to ${crew.name}`}>
      <StyledNote>
        They'll get an email link to create their account and join this crew.
      </StyledNote>

      {!isOnline && (
        <StyledNote role="status">
          You're offline. Connect to the internet to send an invite.
        </StyledNote>
      )}

      {invitePlanLimitError && (
        <StyledUpgradePrompt role="alert">
          <StyledUpgradeText>{invitePlanLimitError.message}</StyledUpgradeText>
          <StyledUpgradeLink to="/pricing">See plans</StyledUpgradeLink>
        </StyledUpgradePrompt>
      )}

      <Form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField id={emailId} label="Email" error={errors.email?.message}>
          <TextInput
            id={emailId}
            type="email"
            autoComplete="email"
            placeholder="foreman@company.com"
            disabled={!isOnline}
            hasError={!!errors.email}
            {...register("email")}
          />
        </FormField>
        <FormField id={roleId} label="Role">
          <Select id={roleId} options={ROLE_OPTIONS} disabled={!isOnline} {...register("role")} />
        </FormField>
        <StyledActions>
          <Button type="button" variant="outline" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md" loading={isInviting} disabled={!isOnline}>
            Send invite
          </Button>
        </StyledActions>
      </Form>
    </Modal>
  );
};
