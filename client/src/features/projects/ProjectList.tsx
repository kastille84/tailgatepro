import { Button } from "../../ui_comps/button";
import type { JobsiteMembership } from "../../interfaces/jobsite";
import type { Project } from "../../interfaces/project";
import { ProjectCadenceControl } from "./ProjectCadenceControl";
import {
  StyledArchivedBadge,
  StyledCard,
  StyledCardActions,
  StyledCardMain,
  StyledEmpty,
  StyledLinkedBadge,
  StyledList,
  StyledMeta,
  StyledName,
  StyledStatusBadge,
} from "./styles";

interface ProjectListProps {
  projects: Project[];
  onEdit: (project: Project) => void;
  /** Present ⇒ live projects get a "Link to GC" / "Unlink GC" action. The page
   *  passes it only for subcontractors (the server 403s a GC), so the list
   *  itself stays free of any account-type logic. */
  onLinkGc?: (project: Project) => void;
  /** The sub's memberships keyed by jobsite id. A live project linked to one
   *  of these gets its own talk-cadence control. */
  cadenceByJobsiteId?: Map<string, JobsiteMembership>;
  /** Projects whose create is still queued offline. Linking one would 404
   *  ("Project not found") until it syncs, so its link action is disabled. */
  unsyncedProjectIds?: Set<string>;
}

/** Presentational list of project cards. The page owns the data and the
 *  create/edit/link state; this component only renders and reports clicks. */
export const ProjectList = ({
  projects,
  onEdit,
  onLinkGc,
  cadenceByJobsiteId,
  unsyncedProjectIds,
}: ProjectListProps) => {
  if (projects.length === 0) {
    return (
      <StyledEmpty>
        No projects yet. Add your first job site to start logging safety talks
        against it.
      </StyledEmpty>
    );
  }

  return (
    <StyledList>
      {projects.map((project) => {
        const linkLabel = project.gcCompanyId ? "Unlink GC" : "Link to GC";
        const isUnsynced = unsyncedProjectIds?.has(project.id) ?? false;
        const showLinkAction = Boolean(onLinkGc) && !project.archivedAt;
        const membership =
          project.jobsiteId && !project.archivedAt
            ? cadenceByJobsiteId?.get(project.jobsiteId)
            : undefined;

        return (
          <StyledCard key={project.id}>
            <StyledCardMain>
              <StyledName>{project.name}</StyledName>
              <StyledMeta>GC: {project.gcNameCustom ?? "—"}</StyledMeta>
              {showLinkAction && isUnsynced && (
                <StyledMeta id={`unsynced-${project.id}`}>
                  Syncing — GC linking is available once this project is saved.
                </StyledMeta>
              )}
            </StyledCardMain>
            <StyledCardActions>
              {project.gcCompanyId && (
                <StyledLinkedBadge>GC linked</StyledLinkedBadge>
              )}
              {project.archivedAt ? (
                <StyledArchivedBadge>Archived</StyledArchivedBadge>
              ) : (
                <StyledStatusBadge $status={project.status}>
                  {project.status}
                </StyledStatusBadge>
              )}
              {onLinkGc && !project.archivedAt && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onLinkGc(project)}
                  disabled={isUnsynced}
                  aria-describedby={
                    isUnsynced ? `unsynced-${project.id}` : undefined
                  }
                  aria-label={`${linkLabel} for ${project.name}`}
                >
                  {linkLabel}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(project)}
                aria-label={`Edit ${project.name}`}
              >
                Edit
              </Button>
            </StyledCardActions>
            {membership && <ProjectCadenceControl membership={membership} />}
          </StyledCard>
        );
      })}
    </StyledList>
  );
};
