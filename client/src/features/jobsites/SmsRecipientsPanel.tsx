import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "../../ui_comps/button";
import { Form, FormField, TextInput } from "../../ui_comps/form";
import { Select } from "../../ui_comps/select";
import { useOnlineStatus } from "../../context/online-status";
import { useJobsiteSmsRecipients } from "../../hooks/useJobsiteSmsRecipients";
import type { Jobsite } from "../../interfaces/jobsite";
import type { SmsRecipient } from "../../interfaces/sms";
import {
  StyledMeta,
  StyledName,
  StyledNote,
  StyledRosterList,
  StyledRosterMain,
  StyledRosterRow,
  StyledRosterStatus,
} from "./styles";

// The server re-validates the number (US/Canada, E.164).
const recipientSchema = z.object({
  rosterId: z.string().min(1, "Choose a subcontractor"),
  phone: z.string().trim().min(1, "Enter a mobile number"),
});

type RecipientValues = z.infer<typeof recipientSchema>;

const statusLabel = (recipient: SmsRecipient) => {
  if (recipient.optedOut) return "Opted out";
  return recipient.confirmedAt ? "Confirmed" : "Awaiting YES reply";
};

interface SmsRecipientsPanelProps {
  jobsite: Jobsite;
}

/** The numbers a GC has entered for one Site Pro jobsite's Monday text
 *  reminder (Phase 9e, docs/sms-nudges-design.md). A number only gets texts
 *  after its owner replies YES to the confirmation the server sends when it is
 *  added. A foreman can also opt in themself in Settings, which needs no entry
 *  here. Online-only. */
export const SmsRecipientsPanel = ({ jobsite }: SmsRecipientsPanelProps) => {
  const { isOnline } = useOnlineStatus();
  const {
    recipients,
    isLoading,
    isError,
    addRecipient,
    isAdding,
    removeRecipient,
    isRemoving,
  } = useJobsiteSmsRecipients(jobsite.id);

  // A locked sub's identity is hidden by the GC's plan, so it can't be picked.
  const acceptedSubs = jobsite.subcontractors.filter(
    (sub) => sub.status === "accepted" && !sub.locked,
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RecipientValues>({
    resolver: zodResolver(recipientSchema),
    mode: "onTouched",
    defaultValues: { rosterId: "", phone: "" },
  });

  const subId = "sms-recipient-sub";
  const phoneId = "sms-recipient-phone";

  const onSubmit = async (values: RecipientValues) => {
    try {
      await addRecipient(values);
      reset({ rosterId: "", phone: "" });
    } catch {
      // useJobsiteSmsRecipients already surfaces the failure as a toast.
    }
  };

  const handleRemove = async (recipientId: string) => {
    try {
      await removeRecipient(recipientId);
    } catch {
      // useJobsiteSmsRecipients already surfaces the failure as a toast.
    }
  };

  return (
    <>
      <StyledNote>
        {jobsite.smsNudgesEnabled
          ? "Monday 7:00 AM text reminders are on for this job site."
          : "Monday text reminders are off. Turn them on with Edit on the job site."}{" "}
        Add a foreman&apos;s mobile number below; we text them once to confirm.
        Foremen can also turn reminders on themselves in Settings.
      </StyledNote>

      {isError && (
        <StyledNote role="alert">Could not load the text reminder numbers.</StyledNote>
      )}

      {!isLoading && recipients.length > 0 && (
        <StyledRosterList>
          {recipients.map((recipient) => (
            <StyledRosterRow key={recipient.id}>
              <StyledRosterMain>
                <StyledName>{recipient.subCompanyName ?? "Subcontractor"}</StyledName>
                <StyledMeta>{recipient.phone}</StyledMeta>
              </StyledRosterMain>
              <StyledRosterStatus
                $accepted={Boolean(recipient.confirmedAt) && !recipient.optedOut}
              >
                {statusLabel(recipient)}
              </StyledRosterStatus>
              <Button
                variant="outline"
                size="sm"
                disabled={!isOnline || isRemoving}
                onClick={() => handleRemove(recipient.id)}
                aria-label={`Remove ${recipient.phone}`}
              >
                Remove
              </Button>
            </StyledRosterRow>
          ))}
        </StyledRosterList>
      )}

      {acceptedSubs.length === 0 ? (
        <StyledNote>
          Once a subcontractor accepts, you can add their foreman&apos;s number
          here.
        </StyledNote>
      ) : (
        <Form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FormField id={subId} label="Subcontractor" error={errors.rosterId?.message}>
            <Select
              id={subId}
              placeholder="Choose a subcontractor"
              options={acceptedSubs.map((sub) => ({
                value: sub.id,
                label: sub.companyName ?? sub.email ?? "Subcontractor",
              }))}
              disabled={!isOnline}
              hasError={!!errors.rosterId}
              {...register("rosterId")}
            />
          </FormField>
          <FormField id={phoneId} label="Foreman mobile number" error={errors.phone?.message}>
            <TextInput
              id={phoneId}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="(555) 123-4567"
              disabled={!isOnline}
              hasError={!!errors.phone}
              {...register("phone")}
            />
          </FormField>
          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={isAdding}
            disabled={!isOnline}
          >
            Add number
          </Button>
        </Form>
      )}
    </>
  );
};
