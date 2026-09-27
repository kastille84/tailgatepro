import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "../../ui_comps/button";
import { Form, FormField, TextInput } from "../../ui_comps/form";
import { Select, type SelectOption } from "../../ui_comps/select";
import { useOnlineStatus } from "../../context/online-status";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { useInviteTeammate } from "../../hooks/useInviteTeammate";
import type { InviteRole } from "../../interfaces/companyInvite";
import {
  StyledInviteFields,
  StyledInviteNote,
  StyledSectionHelp,
  StyledUpgradeLink,
  StyledUpgradePrompt,
  StyledUpgradeText,
} from "./styles";

const ROLE_OPTIONS: SelectOption[] = [
  { value: "foreman", label: "Foreman" },
  { value: "safety_manager", label: "Safety Director" },
  { value: "admin", label: "Admin" },
];

// Superintendent (Phase 9d-2) is a GC-only, GC-Portfolio-only role: it makes
// no sense for a subcontractor company, and the server 403 PLAN_LIMIT on any
// other GC plan. Appended rather than merged into ROLE_OPTIONS so a
// subcontractor's dropdown, and a non-Portfolio GC's, never offer it.
const SUPERINTENDENT_OPTION: SelectOption = {
  value: "superintendent",
  label: "Superintendent",
};

// Mirrors the validator in server/routes/companies.js's POST /invite chain.
const inviteSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
  role: z.enum(["admin", "safety_manager", "foreman", "superintendent"]),
});

type InviteValues = z.infer<typeof inviteSchema>;

/**
 * The "Invite a teammate" section on Settings — an admin/safety_manager
 * enters an email and picks a role, and the server sends an invite email
 * (Phase 8c). Owns its own mutation (`useInviteTeammate`), unlike
 * `JoinCodeCard`'s display-only/caller-owns-the-query shape, since this is a
 * "submit and send an email" action, not a "show me a value" display.
 *
 * Online-only: sending the invite email needs a live server round-trip, so
 * offline shows an explanation and disables the form instead of queueing.
 */
export const InviteTeammateForm = () => {
  const { isOnline } = useOnlineStatus();
  const { isGc } = useCurrentUser();
  const { inviteTeammate, isInviting, planLimitError } = useInviteTeammate();
  // Offered on every GC plan, not just Portfolio: picking it on GC Free/Site
  // Pro still submits, and the server's 403 PLAN_LIMIT surfaces below as the
  // same inline upgrade prompt a jobsite-cap rejection uses — no need to
  // pre-filter the option by plan here.
  const roleOptions = isGc ? [...ROLE_OPTIONS, SUPERINTENDENT_OPTION] : ROLE_OPTIONS;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    mode: "onTouched",
    defaultValues: { email: "", role: "foreman" },
  });

  const emailId = "invite-teammate-email";
  const roleId = "invite-teammate-role";

  const onSubmit = async (values: InviteValues) => {
    try {
      await inviteTeammate({ email: values.email, role: values.role as InviteRole });
      reset({ email: "", role: "foreman" });
    } catch {
      // useInviteTeammate already surfaces the failure as a toast.
    }
  };

  return (
    <>
      <StyledSectionHelp>
        Invite a teammate by email. They'll get a link to create their
        account and join your company at the role you pick.
      </StyledSectionHelp>

      {!isOnline && (
        <StyledInviteNote role="status">
          You're offline. Connect to the internet to send an invite.
        </StyledInviteNote>
      )}

      {planLimitError && (
        <StyledUpgradePrompt role="alert">
          <StyledUpgradeText>{planLimitError.message}</StyledUpgradeText>
          <StyledUpgradeLink to="/pricing">See plans</StyledUpgradeLink>
        </StyledUpgradePrompt>
      )}

      <Form onSubmit={handleSubmit(onSubmit)} noValidate>
        <StyledInviteFields>
          <FormField id={emailId} label="Email" error={errors.email?.message}>
            <TextInput
              id={emailId}
              type="email"
              autoComplete="email"
              placeholder="teammate@company.com"
              disabled={!isOnline}
              hasError={!!errors.email}
              {...register("email")}
            />
          </FormField>

          {/* No error display here: `role` is a bounded Select seeded with a
              valid defaultValue ("foreman"), so the Zod enum check can never
              actually fail from this UI. */}
          <FormField id={roleId} label="Role">
            <Select id={roleId} options={roleOptions} disabled={!isOnline} {...register("role")} />
          </FormField>
        </StyledInviteFields>

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
    </>
  );
};
