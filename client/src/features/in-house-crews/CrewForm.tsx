import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "../../ui_comps/button";
import { Form, FormField, TextInput } from "../../ui_comps/form";
import { Modal } from "../../ui_comps/modal";
import { useOnlineStatus } from "../../context/online-status";
import { useCurrentCompany } from "../../hooks/useCurrentCompany";
import { useInHouseCrewActions } from "../../hooks/useInHouseCrews";
import { useJobsites } from "../../hooks/useJobsites";
import { IN_HOUSE_TRADES } from "../../constants/inHouseTrades";
import type { InHouseCrew } from "../../interfaces/inHouseCrew";
import { ChecklistField } from "./ChecklistField";
import { CrewInviteModal } from "./CrewInviteModal";
import {
  StyledActions,
  StyledChip,
  StyledChips,
  StyledNote,
  StyledUpgradeLink,
  StyledUpgradePrompt,
  StyledUpgradeText,
} from "./styles";

// Mirrors the validator in server/routes/companies.js's POST /in-house chain,
// plus a trailing-dash check so the "Other" prefill can't be submitted bare.
const crewSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Crew name is required")
    .max(120, "Crew name is too long")
    .refine((name) => !name.endsWith("-"), "Add the trade after the dash"),
});

type CrewValues = z.infer<typeof crewSchema>;

interface CrewFormProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Adds in-house crews. The name is the only field: the trade chips just
 *  prefill it ("{GC name} - {Trade}"), "Other" prefills the dash and focuses
 *  the input so any trade can be typed, and the name can always be edited. */
export const CrewForm = ({ isOpen, onClose }: CrewFormProps) => {
  const { isOnline } = useOnlineStatus();
  const { company } = useCurrentCompany();
  const { createCrew, isCreating, createPlanLimitError } = useInHouseCrewActions();
  // The crew just added with "Add crew": a crew nobody can log into is a dead
  // end, so the modal offers to invite its foreman before closing.
  const [addedCrew, setAddedCrew] = useState<InHouseCrew | undefined>(undefined);
  const [isInviting, setIsInviting] = useState(false);

  // Job sites the crew goes on: every live site, pre-ticked; the GC unticks the
  // ones that do not need this trade (a crew on a site it does not work shows up
  // as "missing" on the dashboard).
  const { jobsites } = useJobsites();
  const liveSites = jobsites.filter((site) => site.status === "active" && !site.archivedAt);
  const [uncheckedSiteIds, setUncheckedSiteIds] = useState<string[]>([]);
  const toggleSite = (id: string) =>
    setUncheckedSiteIds((current) =>
      current.includes(id) ? current.filter((other) => other !== id) : [...current, id],
    );

  const close = () => {
    setAddedCrew(undefined);
    setIsInviting(false);
    onClose();
  };

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setFocus,
    formState: { errors },
  } = useForm<CrewValues>({
    resolver: zodResolver(crewSchema),
    mode: "onTouched",
    defaultValues: { name: "" },
  });

  const prefix = company ? `${company.name} - ` : "";

  const pickTrade = (trade: string) => {
    setValue("name", `${prefix}${trade}`, { shouldTouch: true, shouldValidate: true });
  };

  const pickOther = () => {
    setValue("name", prefix, { shouldValidate: false });
    setFocus("name");
  };

  const save = (addAnother: boolean) => async (values: CrewValues) => {
    try {
      const crew = await createCrew({
        name: values.name,
        jobsiteIds: liveSites
          .filter((site) => !uncheckedSiteIds.includes(site.id))
          .map((site) => site.id),
      });
      reset({ name: "" });
      if (!addAnother) setAddedCrew(crew);
    } catch {
      // useInHouseCrewActions already surfaces the failure as a toast / inline prompt.
    }
  };

  const nameId = "crew-name";

  if (addedCrew && isInviting) {
    return <CrewInviteModal crew={addedCrew} onClose={close} />;
  }

  if (addedCrew) {
    return (
      <Modal isOpen={isOpen} onClose={close} title="Crew added">
        <StyledNote>
          <strong>{addedCrew.name}</strong> was added. Nobody can log in as this
          crew until you invite them. Enter your foreman's email and they'll get a link to create
          their account (any email address works).
        </StyledNote>
        <StyledActions>
          <Button type="button" variant="outline" size="md" onClick={close}>
            Later
          </Button>
          <Button type="button" variant="primary" size="md" onClick={() => setIsInviting(true)}>
            Invite someone
          </Button>
        </StyledActions>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={close} title="Add in-house crews">
      <StyledNote>
        Pick a trade, or type your own. Then choose which job sites the crew works on.
      </StyledNote>

      {!isOnline && (
        <StyledNote role="status">You're offline. Connect to the internet to add a crew.</StyledNote>
      )}

      {createPlanLimitError && (
        <StyledUpgradePrompt role="alert">
          <StyledUpgradeText>{createPlanLimitError.message}</StyledUpgradeText>
          <StyledUpgradeLink to="/pricing">See plans</StyledUpgradeLink>
        </StyledUpgradePrompt>
      )}

      <Form onSubmit={handleSubmit(save(false))} noValidate>
        <StyledChips role="group" aria-label="Trade">
          {IN_HOUSE_TRADES.map((trade) => (
            <StyledChip key={trade} type="button" onClick={() => pickTrade(trade)}>
              {trade}
            </StyledChip>
          ))}
          <StyledChip type="button" onClick={pickOther}>
            Other
          </StyledChip>
        </StyledChips>

        <FormField id={nameId} label="Crew name" error={errors.name?.message}>
          <TextInput
            id={nameId}
            type="text"
            placeholder="Your Company - Framing"
            disabled={!isOnline}
            hasError={!!errors.name}
            {...register("name")}
          />
        </FormField>

        {liveSites.length > 0 && (
          <ChecklistField
            legend="Job sites"
            options={liveSites.map((site) => ({ id: site.id, label: site.name }))}
            uncheckedIds={uncheckedSiteIds}
            onToggle={toggleSite}
            disabled={!isOnline}
          />
        )}

        <StyledActions>
          <Button type="button" variant="outline" size="md" onClick={close}>
            Done
          </Button>
          <Button
            type="button"
            variant="outline"
            size="md"
            loading={isCreating}
            disabled={!isOnline}
            onClick={handleSubmit(save(true))}
          >
            Add another
          </Button>
          <Button type="submit" variant="primary" size="md" loading={isCreating} disabled={!isOnline}>
            Add crew
          </Button>
        </StyledActions>
      </Form>
    </Modal>
  );
};
