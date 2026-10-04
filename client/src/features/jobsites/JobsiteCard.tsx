import { useId, useState } from "react";
import {
  HiOutlineArrowCircleUp,
  HiOutlineDownload,
  HiOutlinePencil,
  HiOutlinePuzzle,
  HiOutlineUserGroup,
  HiOutlineUsers,
} from "react-icons/hi";

import { Button } from "../../ui_comps/button";
import type { Jobsite } from "../../interfaces/jobsite";
import {
  StyledActionsPanel,
  StyledActionsToggle,
  StyledArchivedBadge,
  StyledCard,
  StyledCardActions,
  StyledCardMain,
  StyledChevron,
  StyledMeta,
  StyledName,
  StyledOriginBadge,
  StyledStatusBadge,
} from "./styles";

interface JobsiteCardProps {
  jobsite: Jobsite;
  onEdit?: (jobsite: Jobsite) => void;
  onManageSubs: (jobsite: Jobsite) => void;
  onManageMembers?: (jobsite: Jobsite) => void;
  onManageIntegrations?: (jobsite: Jobsite) => void;
  onUpgrade?: (jobsite: Jobsite) => void;
  onDownloadBundle: (jobsite: Jobsite) => void;
  isDownloadingBundle: boolean;
  isOnline: boolean;
}

const describeRoster = (jobsite: Jobsite) => {
  const accepted = jobsite.subcontractors.filter(
    (sub) => sub.status === "accepted",
  ).length;
  const pending = jobsite.subcontractors.length - accepted;
  return `${accepted} subcontractor${accepted === 1 ? "" : "s"}, ${pending} pending`;
};

/** One job site card. The action buttons live in a collapsible panel
 *  (collapsed by default) so the card stays compact on a phone; the name,
 *  roster summary and badges stay visible. */
export const JobsiteCard = ({
  jobsite,
  onEdit,
  onManageSubs,
  onManageMembers,
  onManageIntegrations,
  onUpgrade,
  onDownloadBundle,
  isDownloadingBundle,
  isOnline,
}: JobsiteCardProps) => {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <StyledCard>
      <StyledCardMain>
        <StyledName>{jobsite.name}</StyledName>
        <StyledMeta>{describeRoster(jobsite)}</StyledMeta>
        {jobsite.createdBySub && (
          <StyledOriginBadge>Created by subcontractor</StyledOriginBadge>
        )}
        {jobsite.sitePro && jobsite.plan !== "site_pro" && (
          <StyledOriginBadge>Covered by GC Portfolio</StyledOriginBadge>
        )}
      </StyledCardMain>
      <StyledCardActions>
        {jobsite.archivedAt ? (
          <StyledArchivedBadge>Archived</StyledArchivedBadge>
        ) : (
          <StyledStatusBadge $status={jobsite.status}>{jobsite.status}</StyledStatusBadge>
        )}
      </StyledCardActions>
      <StyledActionsToggle
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Actions for ${jobsite.name}`}
        onClick={() => setOpen((prev) => !prev)}
      >
        Actions
        <StyledChevron $open={open} aria-hidden="true" />
      </StyledActionsToggle>
      {open && (
        <StyledActionsPanel id={panelId} role="group" aria-label={`${jobsite.name} actions`}>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<HiOutlineUsers />}
            onClick={() => onManageSubs(jobsite)}
            aria-label={`Subcontractors for ${jobsite.name}`}
          >
            Subs
          </Button>
          {onManageMembers && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<HiOutlineUserGroup />}
              onClick={() => onManageMembers(jobsite)}
              aria-label={`Superintendents for ${jobsite.name}`}
            >
              Team
            </Button>
          )}
          {onManageIntegrations && jobsite.sitePro && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<HiOutlinePuzzle />}
              onClick={() => onManageIntegrations(jobsite)}
              aria-label={`Integrations for ${jobsite.name}`}
            >
              Integrations
            </Button>
          )}
          {jobsite.sitePro ? (
            <Button
              variant="outline"
              size="sm"
              disabled={!isOnline}
              loading={isDownloadingBundle}
              leftIcon={<HiOutlineDownload />}
              onClick={() => onDownloadBundle(jobsite)}
              aria-label={`Download OSHA Defense Bundle for ${jobsite.name}`}
              title={`Download OSHA Defense Bundle for ${jobsite.name}`}
            >
              Defense Bundle
            </Button>
          ) : onUpgrade && !jobsite.archivedAt && jobsite.status === "active" ? (
            <Button
              variant="primary"
              size="sm"
              disabled={!isOnline}
              leftIcon={<HiOutlineArrowCircleUp />}
              onClick={() => onUpgrade(jobsite)}
              aria-label={`Upgrade ${jobsite.name} to Site Pro`}
            >
              Upgrade to Site Pro
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<HiOutlineDownload />}
              disabled={true}
              aria-label={`Download OSHA Defense Bundle for ${jobsite.name}`}
            >
              Defense Bundle
            </Button>
          )}
          {onEdit && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<HiOutlinePencil />}
              onClick={() => onEdit(jobsite)}
              aria-label={`Edit ${jobsite.name}`}
            >
              Edit
            </Button>
          )}
        </StyledActionsPanel>
      )}
    </StyledCard>
  );
};
