import { useState } from "react";

import { useAuth } from "../../context/auth";
import { useProjects } from "../../hooks/useProjects";
import { Button } from "../../ui_comps/button";
import { Checkbox } from "../../ui_comps/checkbox";
import { Footer } from "../../ui_comps/footer";
import { Spinner } from "../../ui_comps/spinner";
import { ProjectForm, ProjectList } from "../../features/projects";
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
 *  Navbar. Owns the create/edit modal state; the data comes from `useProjects`.
 *  Re-checks the session defensively even though it sits behind `RequireAuth`. */
export const Projects = () => {
  const { user, loading } = useAuth();

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
          <StyledEyebrow>Projects</StyledEyebrow>
          <StyledHeadline id="projects-hero-heading">
            Your job sites
          </StyledHeadline>
          <StyledLede>
            Every project you run safety talks on. Add a site, then log talks
            against it.
          </StyledLede>
        </StyledHeroInner>
      </StyledHero>

      <StyledSection>
        <StyledContainer>
          <StyledToolbar>
            <Checkbox
              label="Show archived"
              checked={showArchived}
              onChange={(event) => setShowArchived(event.target.checked)}
            />
            <Button variant="primary" size="md" onClick={openCreate}>
              New project
            </Button>
          </StyledToolbar>

          {isLoading && <Spinner center message="Loading projects…" />}
          {isError && (
            <StyledError role="alert">
              Could not load your projects. Refresh to try again.
            </StyledError>
          )}
          {!isLoading && !isError && (
            <ProjectList projects={projects} onEdit={openEdit} />
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
    </StyledPage>
  );
};
