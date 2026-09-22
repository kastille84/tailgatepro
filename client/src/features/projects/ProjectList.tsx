import { Button } from "../../ui_comps/button";
import type { Project } from "../../interfaces/project";
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
}

/** Presentational list of project cards. The page owns the data and the
 *  create/edit/link state; this component only renders and reports clicks. */
export const ProjectList = ({
  projects,
  onEdit,
  onLinkGc,
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

        return (
          <StyledCard key={project.id}>
            <StyledCardMain>
              <StyledName>{project.name}</StyledName>
              <StyledMeta>GC: {project.gcNameCustom ?? "—"}</StyledMeta>
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
          </StyledCard>
        );
      })}
    </StyledList>
  );
};
