import { useId, useState } from "react";

import { HiOutlineLink, HiOutlinePencil, HiOutlinePuzzle } from "react-icons/hi";

import { Button } from "../../ui_comps/button";
import type { JobsiteMembership } from "../../interfaces/jobsite";
import type { Project } from "../../interfaces/project";
import { ProjectCadenceControl } from "./ProjectCadenceControl";
import {
  StyledActionsPanel,
  StyledActionsToggle,
  StyledArchivedBadge,
  StyledCard,
  StyledCardActions,
  StyledCardMain,
  StyledChevron,
  StyledLinkedBadge,
  StyledMeta,
  StyledName,
  StyledStatusBadge,
} from "./styles";

interface ProjectCardProps {
  project: Project;
  onEdit: (project: Project) => void;
  onLinkGc?: (project: Project) => void;
  onManageIntegrations?: (project: Project) => void;
  membership?: JobsiteMembership;
  isUnsynced: boolean;
}

/** One project card. The Link-to-GC / Integrations / Edit buttons live in a
 *  collapsible panel (collapsed by default) so the card stays compact on a
 *  phone; the badges and the cadence control stay visible. */
export const ProjectCard = ({
  project,
  onEdit,
  onLinkGc,
  onManageIntegrations,
  membership,
  isUnsynced,
}: ProjectCardProps) => {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const linkLabel = project.gcCompanyId ? "Unlink GC" : "Link to GC";
  const isLive = !project.archivedAt;
  const showLinkAction = (Boolean(onLinkGc) || Boolean(onManageIntegrations)) && isLive;
  const describedBy = isUnsynced ? `unsynced-${project.id}` : undefined;

  return (
    <StyledCard>
      <StyledCardMain>
        <StyledName>{project.name}</StyledName>
        <StyledMeta>GC: {project.gcNameCustom ?? "—"}</StyledMeta>
        {showLinkAction && isUnsynced && (
          <StyledMeta id={`unsynced-${project.id}`}>
            Syncing — GC linking and integrations are available once this project is saved.
          </StyledMeta>
        )}
      </StyledCardMain>
      <StyledCardActions>
        {project.gcCompanyId && <StyledLinkedBadge>GC linked</StyledLinkedBadge>}
        {isLive ? (
          <StyledStatusBadge $status={project.status}>{project.status}</StyledStatusBadge>
        ) : (
          <StyledArchivedBadge>Archived</StyledArchivedBadge>
        )}
      </StyledCardActions>
      <StyledActionsToggle
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Actions for ${project.name}`}
        onClick={() => setOpen((prev) => !prev)}
      >
        Actions
        <StyledChevron $open={open} aria-hidden="true" />
      </StyledActionsToggle>
      {open && (
        <StyledActionsPanel id={panelId} role="group" aria-label={`${project.name} actions`}>
          {onLinkGc && isLive && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<HiOutlineLink />}
              onClick={() => onLinkGc(project)}
              disabled={isUnsynced}
              aria-describedby={describedBy}
              aria-label={`${linkLabel} for ${project.name}`}
            >
              {linkLabel}
            </Button>
          )}
          {onManageIntegrations && isLive && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<HiOutlinePuzzle />}
              onClick={() => onManageIntegrations(project)}
              disabled={isUnsynced}
              aria-describedby={describedBy}
              aria-label={`Integrations for ${project.name}`}
            >
              Integrations
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            leftIcon={<HiOutlinePencil />}
            onClick={() => onEdit(project)}
            aria-label={`Edit ${project.name}`}
          >
            Edit
          </Button>
        </StyledActionsPanel>
      )}
      {membership && <ProjectCadenceControl membership={membership} />}
    </StyledCard>
  );
};
