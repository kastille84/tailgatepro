import { useState } from "react";

import { useAuth } from "../../context/auth";
import { useOnlineStatus } from "../../context/online-status";
import { useGcOverview } from "../../hooks/useGcOverview";
import { Footer } from "../../ui_comps/footer";
import { Spinner } from "../../ui_comps/spinner";
import {
  JobsiteList,
  StatTiles,
  SubMeetingsModal,
} from "../../features/gc-dashboard";
import type { GcSubCompliance } from "../../interfaces/gcDashboard";
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
} from "./GcDashboard.styles";

/** Today's local date (`YYYY-MM-DD`) and the viewer's timezone offset, in the
 *  shape `GET /api/gc/overview` expects. Built from local getters, not
 *  `toISOString()` — that's UTC and would misreport the date near local
 *  midnight, the same class of bug the server's `held_at` handling avoids. */
const getLocalDateAndTzOffset = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return { date: `${year}-${month}-${day}`, tzOffset: now.getTimezoneOffset() };
};

/** The GC compliance dashboard, reached from the Dashboard hub. Online-only,
 *  read-only (`docs/gc-dashboard-design.md`). Re-checks the session
 *  defensively even though it sits behind `RequireAuth` + `RequireGc`. */
export const GcDashboard = () => {
  const { user, loading } = useAuth();
  const { isOnline } = useOnlineStatus();

  const { date, tzOffset } = getLocalDateAndTzOffset();
  const { overview, isLoading, isError } = useGcOverview(date, tzOffset);

  const [selectedSub, setSelectedSub] = useState<GcSubCompliance | undefined>(
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
      <StyledHero aria-labelledby="gc-dashboard-hero-heading">
        <StyledHeroInner>
          <StyledEyebrow>GC Compliance</StyledEyebrow>
          <StyledHeadline id="gc-dashboard-hero-heading">
            Today's job sites
          </StyledHeadline>
          <StyledLede>
            Which linked subcontractors have logged a safety talk today.
          </StyledLede>
        </StyledHeroInner>
      </StyledHero>

      <StyledSection>
        <StyledContainer>
          {!isOnline && (
            <StyledOfflineNote role="status">
              You're offline. Reconnect to see today's compliance status.
            </StyledOfflineNote>
          )}

          {isLoading && <Spinner center message="Loading compliance…" />}
          {isError && (
            <StyledError role="alert">
              Could not load compliance data. Refresh to try again.
            </StyledError>
          )}
          {!isLoading && !isError && overview && (
            <>
              <StatTiles totals={overview.totals} />
              <JobsiteList
                jobsites={overview.jobsites}
                onSelectSub={setSelectedSub}
              />
            </>
          )}
        </StyledContainer>
      </StyledSection>

      <Footer />

      <SubMeetingsModal
        sub={selectedSub}
        onClose={() => setSelectedSub(undefined)}
      />
    </StyledPage>
  );
};
