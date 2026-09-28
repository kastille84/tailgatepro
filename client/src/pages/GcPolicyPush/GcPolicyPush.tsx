import { useAuth } from "../../context/auth";
import { useOnlineStatus } from "../../context/online-status";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { useGcPolicyPush } from "../../hooks/useGcPolicyPush";
import {
  ClearPushButton,
  CurrentPushCard,
  PolicyComplianceTable,
  PolicyPushUpgradeNotice,
  PushTopicForm,
} from "../../features/gc-policy-push";
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
  StyledSubheading,
} from "./GcPolicyPush.styles";

/** Server-enforced (`requireRole(...MANAGER_ROLES)`); mirrored here only to
 *  hide controls a GC foreman/superintendent would get a 403 from. */
const MANAGER_ROLES = ["admin", "safety_manager"];

/** Today's local date (`YYYY-MM-DD`) and the viewer's timezone offset -- same
 *  shape `GET /api/gc/policy-push` expects. Duplicated from the other GC
 *  pages' own helper rather than shared, per this codebase's existing
 *  precedent (see GcSubcontractors.tsx's identical comment). */
const getLocalDateAndTzOffset = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return { date: `${year}-${month}-${day}`, tzOffset: now.getTimezoneOffset() };
};

/** Top-down corporate policy push (Phase 9e, docs/policy-push-design.md),
 *  reached from the Navbar. GC Portfolio only -- the nav link and this page
 *  stay visible to every GC as a selling point, but a non-Portfolio GC sees
 *  an upgrade banner instead of real data (the server enforces the actual
 *  gate regardless). The push/clear controls are further limited to
 *  admin/safety_manager; a site-scoped superintendent sees a read-only view
 *  narrowed to their assigned jobsite. */
export const GcPolicyPush = () => {
  const { user, loading } = useAuth();
  const { isOnline } = useOnlineStatus();
  const { plan, role } = useCurrentUser();
  const isPortfolio = plan === "gc-portfolio";
  const canManage = role !== null && MANAGER_ROLES.includes(role);

  const { date, tzOffset } = getLocalDateAndTzOffset();
  const { policyPush, isLoading, isError } = useGcPolicyPush(date, tzOffset);

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
      <StyledHero aria-labelledby="gc-policy-push-hero-heading">
        <StyledHeroInner>
          <StyledEyebrow>GC Portfolio</StyledEyebrow>
          <StyledHeadline id="gc-policy-push-hero-heading">Policy Push</StyledHeadline>
          <StyledLede>
            Push a mandatory safety topic across every active job site at once, and see
            who's logged it.
          </StyledLede>
        </StyledHeroInner>
      </StyledHero>

      <StyledSection>
        <StyledContainer>
          {isPortfolio && !isOnline && (
            <StyledOfflineNote role="status">
              You're offline. Reconnect to manage your policy push.
            </StyledOfflineNote>
          )}

          {!isPortfolio && <PolicyPushUpgradeNotice />}

          {isPortfolio && isLoading && <Spinner center message="Loading policy push…" />}
          {isPortfolio && isError && (
            <StyledError role="alert">
              Could not load your policy push. Refresh to try again.
            </StyledError>
          )}
          {isPortfolio && !isLoading && !isError && policyPush && (
            <>
              <CurrentPushCard push={policyPush} />

              {canManage && (
                <>
                  <StyledSubheading>Push a required topic</StyledSubheading>
                  <PushTopicForm />
                  {policyPush.talkId && <ClearPushButton />}
                </>
              )}

              {policyPush.talkId && (
                <>
                  <StyledSubheading>Compliance since it was pushed</StyledSubheading>
                  <PolicyComplianceTable jobsites={policyPush.jobsites} />
                </>
              )}
            </>
          )}
        </StyledContainer>
      </StyledSection>

      <Footer />
    </StyledPage>
  );
};
