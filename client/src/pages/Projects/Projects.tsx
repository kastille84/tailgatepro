import { useState } from "react";

import { useAuth } from "../../context/auth";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { useProjects } from "../../hooks/useProjects";
import { Button } from "../../ui_comps/button";
import { Checkbox } from "../../ui_comps/checkbox";
import { Footer } from "../../ui_comps/footer";
import { Spinner } from "../../ui_comps/spinner";
import { JobsiteManager } from "../../features/jobsites";
import {
  GcLinkModal,
  ProjectForm,
  ProjectList,
} from "../../features/projects";
import type { Project } from "../../interfaces/project";
import {
  StyledContainer,
  StyledError,
  StyledEyebrow,
  StyledHeadline,
  StyledHero,
  StyledHeroInner,
  StyledLede,
  StyledPage,
  StyledSection,
  StyledStatus,
  StyledToolbar,
} from "./Projects.styles";

/** The authenticated Projects section, reached from the Dashboard hub and the
 *  Navbar. Owns the create/edit and link-to-GC modal state; the data comes from
 *  `useProjects`. Re-checks the session defensively even though it sits behind
 *  `RequireAuth`. */
export const Projects = () => {
  const { user, loading } = useAuth();
  // Creating and linking a project to a GC are both subcontractor-only (the
  // server 403s a GC on either) — the project model is sub-owned. A GC manages
  // its own job sites instead (JobsiteManager, Phase 8d-e).
  const { isSubcontractor, isGc } = useCurrentUser();

  const [showArchived, setShowArchived] = useState(false);
  const { projects, isLoading, isError } = useProjects(showArchived);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<Project | undefined>(undefined);

  const openCreate = () => {
    setEditing(undefined);
    setIsFormOpen(true);
  };

  const openEdit = (project: Project) => {
    setEditing(project);
    setIsFormOpen(true);
  };

  const closeForm = () => setIsFormOpen(false);

  // Mounted only while a project is being linked/unlinked, so the join-code
  // field starts empty each time.
  const [linkingProject, setLinkingProject] = useState<Project | undefined>(
    undefined,
  );

  if (loading) {
    return (
      <StyledPage>
        <StyledStatus role="status" aria-live="polite">
          Loading…
        </StyledStatus>
      </StyledPage>
    );
  }

  if (!user) {
    return (
      <StyledPage>
        <StyledStatus role="status">Access denied. Please log in.</StyledStatus>
      </StyledPage>
    );
  }

  return (
    <StyledPage>
      <StyledHero aria-labelledby="projects-hero-heading">
        <StyledHeroInner>
          <StyledEyebrow>{isGc ? "Job sites" : "Projects"}</StyledEyebrow>
          <StyledHeadline id="projects-hero-heading">
            Your job sites
          </StyledHeadline>
          <StyledLede>
            {isGc
              ? "Create your job sites and invite the subcontractors working on them."
              : "Every project you run safety talks on. Add a site, then log talks against it."}
          </StyledLede>
        </StyledHeroInner>
      </StyledHero>

      <StyledSection>
        <StyledContainer>
          {isGc ? (
            <JobsiteManager />
          ) : (
            <>
            <StyledToolbar>
              <Checkbox
                label="Show archived"
                checked={showArchived}
                onChange={(event) => setShowArchived(event.target.checked)}
              />
              {isSubcontractor && (
                <Button variant="primary" size="md" onClick={openCreate}>
                  New project
                </Button>
              )}
            </StyledToolbar>

            {isLoading && <Spinner center message="Loading projects…" />}
            {isError && (
              <StyledError role="alert">
                Could not load your projects. Refresh to try again.
              </StyledError>
            )}
            {!isLoading && !isError && (
              <ProjectList
                projects={projects}
                onEdit={openEdit}
                onLinkGc={isSubcontractor ? setLinkingProject : undefined}
              />
            )}
            </>
          )}
        </StyledContainer>
      </StyledSection>

      <Footer />

      <ProjectForm
        key={editing?.id ?? "new"}
        isOpen={isFormOpen}
        onClose={closeForm}
        project={editing}
      />

      {linkingProject && (
        <GcLinkModal
          project={linkingProject}
          onClose={() => setLinkingProject(undefined)}
        />
      )}
    </StyledPage>
  );
};
