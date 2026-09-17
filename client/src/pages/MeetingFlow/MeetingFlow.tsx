import { lazy, Suspense } from "react";

import { useAuth } from "../../context/auth";
import { Footer } from "../../ui_comps/footer";
import { Spinner } from "../../ui_comps/spinner";
import {
  StyledContainer,
  StyledEyebrow,
  StyledHeadline,
  StyledHero,
  StyledHeroInner,
  StyledLede,
  StyledPage,
  StyledSection,
  StyledStatus,
} from "./MeetingFlow.styles";

// signature_pad (and the rest of the meeting-flow feature surface) only
// matters once a foreman actually starts a meeting, so it's fetched from its
// own file rather than the features/meeting-flow barrel -- the barrel also
// re-exports this same component, and a static import of it here would pull
// signature_pad into this page's default bundle, defeating the code-split.
// Mirrors ContentLibrary.tsx's TalkForm precedent.
const MeetingWizard = lazy(() =>
  import("../../features/meeting-flow/MeetingWizard").then((mod) => ({
    default: mod.MeetingWizard,
  })),
);

/** The authenticated meeting wizard entry point, reached from the Dashboard
 *  hub (docs/tasks.md Phase 4g). Re-checks the session defensively even
 *  though it sits behind `RequireAuth`, matching every other authenticated
 *  page. */
export const MeetingFlow = () => {
  const { user, loading } = useAuth();

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
      <StyledHero aria-labelledby="meeting-flow-hero-heading">
        <StyledHeroInner>
          <StyledEyebrow>Meeting Logs</StyledEyebrow>
          <StyledHeadline id="meeting-flow-hero-heading">
            Run a toolbox talk
          </StyledHeadline>
          <StyledLede>
            Pick a project and a talk, present it to the crew, and collect
            signatures — works offline on site.
          </StyledLede>
        </StyledHeroInner>
      </StyledHero>

      <StyledSection>
        <StyledContainer>
          <Suspense fallback={<Spinner center message="Loading…" />}>
            <MeetingWizard />
          </Suspense>
        </StyledContainer>
      </StyledSection>

      <Footer />
    </StyledPage>
  );
};
