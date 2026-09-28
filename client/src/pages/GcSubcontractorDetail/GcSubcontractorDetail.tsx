import { useParams } from "react-router-dom";

import { useAuth } from "../../context/auth";
import { useOnlineStatus } from "../../context/online-status";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { useGcSubcontractorScorecard } from "../../hooks/useGcSubcontractorScorecard";
import {
  JobsiteBreakdownTable,
  ScoreBadge,
  SubScorecardUpgradeNotice,
} from "../../features/gc-subcontractors";
import { StyledBackLink, StyledDetailHeader } from "../../features/gc-subcontractors/styles";
import { Footer } from "../../ui_comps/footer";
import { Spinner } from "../../ui_comps/spinner";
import {
  StyledContainer,
  StyledError,
  StyledHeadline,
  StyledOfflineNote,
  StyledPage,
  StyledSection,
  StyledStatus,
} from "./GcSubcontractorDetail.styles";

const getLocalDateAndTzOffset = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return { date: `${year}-${month}-${day}`, tzOffset: now.getTimezoneOffset() };
};

/** One subcontractor's rolling 30-day score plus its per-jobsite breakdown
 *  (Phase 9e, docs/sub-scorecard-design.md), reached from
 *  `GcSubcontractors`. Same GC Portfolio gating as the list page. */
export const GcSubcontractorDetail = () => {
  const { companyId } = useParams<{ companyId: string }>();
  const { user, loading } = useAuth();
  const { isOnline } = useOnlineStatus();
  const { plan } = useCurrentUser();
  const isPortfolio = plan === "gc-portfolio";

  const { date, tzOffset } = getLocalDateAndTzOffset();
  const { scorecard, isLoading, isError, error } = useGcSubcontractorScorecard(
    isPortfolio ? (companyId ?? "") : "",
    date,
    tzOffset,
  );
  const notFound = error instanceof Error && error.message === "Subcontractor not found";

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
      <StyledSection>
        <StyledContainer>
          <StyledBackLink to="/gc/subcontractors">&larr; All subcontractors</StyledBackLink>

          {isPortfolio && !isOnline && (
            <StyledOfflineNote role="status">
              You're offline. Reconnect to see this subcontractor's scorecard.
            </StyledOfflineNote>
          )}

          {!isPortfolio && <SubScorecardUpgradeNotice />}

          {isPortfolio && isLoading && <Spinner center message="Loading scorecard…" />}
          {isPortfolio && isError && notFound && (
            <StyledError role="alert">
              This subcontractor isn't on your portfolio.
            </StyledError>
          )}
          {isPortfolio && isError && !notFound && (
            <StyledError role="alert">
              Could not load this subcontractor's scorecard. Refresh to try again.
            </StyledError>
          )}
          {isPortfolio && !isLoading && !isError && scorecard && (
            <>
              <StyledDetailHeader>
                <StyledHeadline>{scorecard.companyName ?? "Unknown company"}</StyledHeadline>
                <ScoreBadge score={scorecard.overallScore} size="lg" />
              </StyledDetailHeader>
              <JobsiteBreakdownTable jobsites={scorecard.jobsites} />
            </>
          )}
        </StyledContainer>
      </StyledSection>
      <Footer />
    </StyledPage>
  );
};
