import { useAuth } from "../../context/auth";
import { useOnlineStatus } from "../../context/online-status";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { useGcSubcontractorScorecards } from "../../hooks/useGcSubcontractorScorecards";
import { SubScorecardList, SubScorecardUpgradeNotice } from "../../features/gc-subcontractors";
import { Footer } from "../../ui_comps/footer";
import { Spinner } from "../../ui_comps/spinner";
import {
  StyledContainer,
  StyledError,
  StyledEyebrow,
  StyledHeadline,
  StyledHero,
  StyledHeroInner,
  StyledLede,
  StyledOfflineNote,
  StyledPage,
  StyledSection,
  StyledStatus,
} from "./GcSubcontractors.styles";

/** Today's local date (`YYYY-MM-DD`) and the viewer's timezone offset -- same
 *  shape `GET /api/gc/subcontractors` expects, built from local getters (not
 *  `toISOString()`) so it doesn't misreport the date near local midnight.
 *  Duplicated from GcDashboard's own helper rather than shared -- this
 *  codebase keeps each page/hook's small date helper local (see
 *  useMeetingMonths.ts's own inline `new Date().getTimezoneOffset()`). */
const getLocalDateAndTzOffset = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return { date: `${year}-${month}-${day}`, tzOffset: now.getTimezoneOffset() };
};

/** Cross-project subcontractor safety scorecards (Phase 9e,
 *  docs/sub-scorecard-design.md), reached from the Navbar. GC Portfolio only
 *  -- the nav link and this page stay visible to every GC as a selling
 *  point, but a non-Portfolio GC sees an upgrade banner instead of real data
 *  (the server enforces the actual gate regardless). Online-only, read-only,
 *  same as GcDashboard. */
export const GcSubcontractors = () => {
  const { user, loading } = useAuth();
  const { isOnline } = useOnlineStatus();
  const { plan } = useCurrentUser();
  const isPortfolio = plan === "gc-portfolio";

  const { date, tzOffset } = getLocalDateAndTzOffset();
  const { scorecards, isLoading, isError } = useGcSubcontractorScorecards(date, tzOffset);

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
      <StyledHero aria-labelledby="gc-subcontractors-hero-heading">
        <StyledHeroInner>
          <StyledEyebrow>GC Portfolio</StyledEyebrow>
          <StyledHeadline id="gc-subcontractors-hero-heading">Subcontractors</StyledHeadline>
          <StyledLede>
            Each sub's rolling 30-day safety compliance score across every job site they work
            on with you.
          </StyledLede>
        </StyledHeroInner>
      </StyledHero>

      <StyledSection>
        <StyledContainer>
          {isPortfolio && !isOnline && (
            <StyledOfflineNote role="status">
              You're offline. Reconnect to see subcontractor scorecards.
            </StyledOfflineNote>
          )}

          {!isPortfolio && <SubScorecardUpgradeNotice />}

          {isPortfolio && isLoading && <Spinner center message="Loading scorecards…" />}
          {isPortfolio && isError && (
            <StyledError role="alert">
              Could not load subcontractor scorecards. Refresh to try again.
            </StyledError>
          )}
          {isPortfolio && !isLoading && !isError && scorecards && (
            <SubScorecardList scorecards={scorecards} />
          )}
        </StyledContainer>
      </StyledSection>

      <Footer />
    </StyledPage>
  );
};
