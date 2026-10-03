import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "../../ui_comps/button";
import { Checkbox } from "../../ui_comps/checkbox";
import { Form, FormField, TextInput } from "../../ui_comps/form";
import { useOnlineStatus } from "../../context/online-status";
import { useMySmsOptIn } from "../../hooks/useMySmsOptIn";
import { StyledInviteNote, StyledSectionHelp } from "./styles";

// The server re-validates the number (US/Canada, E.164) and requires consent.
const optInSchema = z.object({
  phone: z.string().trim().min(1, "Enter your mobile number"),
  consent: z.boolean().refine((value) => value, {
    message: "Agree to receive texts to turn reminders on",
  }),
});

type OptInValues = z.infer<typeof optInSchema>;

const CONSENT_LABEL =
  "I agree to receive a weekly safety talk reminder text from TailgatePro at this number. Message and data rates may apply. Reply STOP at any time to opt out.";

/**
 * A foreman's own opt-in to the Monday 7:00 AM safety-talk reminder text
 * (Phase 9e, docs/sms-nudges-design.md). The checkbox is the recorded
 * consent, so it starts unchecked and is required. Online-only.
 */
export const SmsOptInCard = () => {
  const { isOnline } = useOnlineStatus();
  const { optIn, isLoading, isError, saveOptIn, isSaving, clearOptIn, isClearing } =
    useMySmsOptIn();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OptInValues>({
    resolver: zodResolver(optInSchema),
    mode: "onTouched",
    defaultValues: { phone: "", consent: false },
  });

  const phoneId = "sms-opt-in-phone";

  const onSubmit = async ({ phone }: OptInValues) => {
    try {
      await saveOptIn(phone);
      reset({ phone: "", consent: false });
    } catch {
      // useMySmsOptIn already surfaces the failure as a toast.
    }
  };

  const handleRemove = async () => {
    try {
      await clearOptIn();
    } catch {
      // useMySmsOptIn already surfaces the failure as a toast.
    }
  };

  if (isLoading) {
    return <StyledSectionHelp role="status">Loading…</StyledSectionHelp>;
  }

  return (
    <>
      <StyledSectionHelp>
        Get a text at 7:00 AM on Mondays when your general contractor has no
        safety talk logged from your company for the week before.
      </StyledSectionHelp>

      {isError && (
        <StyledInviteNote role="alert">
          Could not load your text reminder settings.
        </StyledInviteNote>
      )}

      {!isOnline && (
        <StyledInviteNote role="status">
          You&apos;re offline. Connect to the internet to change this.
        </StyledInviteNote>
      )}

      {optIn && (
        <StyledInviteNote role="status">
          {optIn.optedOut
            ? `Texts to ${optIn.phone} are paused because you replied STOP. Save your number again below to turn them back on.`
            : `Reminders are on for ${optIn.phone}.`}
        </StyledInviteNote>
      )}

      <Form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField
          id={phoneId}
          label="Mobile number"
          error={errors.phone?.message}
        >
          <TextInput
            id={phoneId}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(555) 123-4567"
            disabled={!isOnline}
            hasError={!!errors.phone}
            {...register("phone")}
          />
        </FormField>

        <Checkbox
          label={CONSENT_LABEL}
          disabled={!isOnline}
          hasError={!!errors.consent}
          {...register("consent")}
        />
        {errors.consent && (
          <StyledInviteNote role="alert">
            {errors.consent.message}
          </StyledInviteNote>
        )}

        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={isSaving}
          disabled={!isOnline}
        >
          {optIn ? "Update number" : "Turn on reminders"}
        </Button>
        {optIn && (
          <Button
            type="button"
            variant="outline"
            size="md"
            loading={isClearing}
            disabled={!isOnline}
            onClick={handleRemove}
          >
            Turn off reminders
          </Button>
        )}
      </Form>
    </>
  );
};
