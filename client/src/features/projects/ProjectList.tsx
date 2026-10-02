import type { JobsiteMembership } from "../../interfaces/jobsite";
import type { Project } from "../../interfaces/project";
import { ProjectCard } from "./ProjectCard";
import { StyledEmpty, StyledList } from "./styles";

interface ProjectListProps {
  projects: Project[];
  onEdit: (project: Project) => void;
  /** Present ⇒ live projects get a "Link to GC" / "Unlink GC" action. The page
   *  passes it only for subcontractors (the server 403s a GC), so the list
   *  itself stays free of any account-type logic. */
  onLinkGc?: (project: Project) => void;
  /** Present ⇒ live projects get an "Integrations" action (Procore / JobTread
   *  document push). Passed only for subcontractor managers. */
  onManageIntegrations?: (project: Project) => void;
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
  onManageIntegrations,
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
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          onEdit={onEdit}
          onLinkGc={onLinkGc}
          onManageIntegrations={onManageIntegrations}
          isUnsynced={unsyncedProjectIds?.has(project.id) ?? false}
          membership={
            project.jobsiteId && !project.archivedAt
              ? cadenceByJobsiteId?.get(project.jobsiteId)
              : undefined
          }
        />
      ))}
    </StyledList>
  );
};
