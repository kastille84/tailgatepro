import { Button } from "../../ui_comps/button";
import type { Project } from "../../interfaces/project";
import {
  StyledCard,
  StyledCardMain,
  StyledEmpty,
  StyledList,
  StyledMeta,
  StyledName,
  StyledStatusBadge,
} from "./styles";

interface ProjectListProps {
  projects: Project[];
  onEdit: (project: Project) => void;
}

/** Presentational list of project cards. The page owns the data and the
 *  create/edit state; this component only renders and reports edit clicks. */
export const ProjectList = ({ projects, onEdit }: ProjectListProps) => {
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
      {projects.map((project) => (
        <StyledCard key={project.id}>
          <StyledCardMain>
            <StyledName>{project.name}</StyledName>
            <StyledMeta>
              GC: {project.gcNameCustom ?? project.gcCompanyId ?? "—"}
            </StyledMeta>
          </StyledCardMain>
          <StyledStatusBadge $status={project.status}>
            {project.status}
          </StyledStatusBadge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(project)}
            aria-label={`Edit ${project.name}`}
          >
            Edit
          </Button>
        </StyledCard>
      ))}
    </StyledList>
  );
};
