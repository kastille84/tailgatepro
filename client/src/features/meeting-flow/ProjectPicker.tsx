import { Button } from "../../ui_comps/button";
import type { Project } from "../../interfaces/project";
import {
  StyledPickerCard,
  StyledPickerCardMain,
  StyledPickerEmpty,
  StyledPickerList,
  StyledPickerMeta,
  StyledPickerName,
} from "./styles";

interface ProjectPickerProps {
  projects: Project[];
  onSelect: (project: Project) => void;
}

/** Step 1 of the meeting wizard: pick which job site this talk is for.
 *  `features/projects/ProjectList` is edit-shaped (`onEdit`), not
 *  selection-shaped, so this is a small dedicated picker rather than a
 *  shared component (docs/tasks.md Phase 4g). */
export const ProjectPicker = ({ projects, onSelect }: ProjectPickerProps) => {
  if (projects.length === 0) {
    return (
      <StyledPickerEmpty>
        No projects yet. Add a job site from the Projects page before
        starting a meeting.
      </StyledPickerEmpty>
    );
  }

  return (
    <StyledPickerList>
      {projects.map((project) => (
        <StyledPickerCard key={project.id}>
          <StyledPickerCardMain>
            <StyledPickerName>{project.name}</StyledPickerName>
            <StyledPickerMeta>
              GC: {project.gcNameCustom ?? project.gcCompanyId ?? "—"}
            </StyledPickerMeta>
          </StyledPickerCardMain>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onSelect(project)}
            aria-label={`Select ${project.name}`}
          >
            Select
          </Button>
        </StyledPickerCard>
      ))}
    </StyledPickerList>
  );
};
