import { HiOutlineDownload } from "react-icons/hi";
import { Link, useSearchParams } from "react-router-dom";

import { useAuth } from "../../context/auth";
import { useOnlineStatus } from "../../context/online-status";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { useDownloadOwnBundle } from "../../hooks/useDownloadOwnBundle";
import { useMeetingMonths } from "../../hooks/useMeetingMonths";
import {
  isValidMonth,
  MonthCards,
  MonthMeetings,
} from "../../features/meeting-history";
import { Button } from "../../ui_comps/button";
import { Footer } from "../../ui_comps/footer";
import { ProgressModal } from "../../ui_comps/progress-modal";
import { Spinner } from "../../ui_comps/spinner";
import {
  StyledBundleRow,
  StyledContainer,
  StyledError,
  StyledEyebrow,
  StyledHeadline,
  StyledHero,
  StyledHeroInner,
  StyledLede,
  StyledPage,
  StyledRetentionNote,
  StyledSection,
  StyledStatus,
  StyledUpgradeBanner,
  StyledUpgradeBody,
  StyledUpgradeTitle,
} from "./MeetingHistory.styles";

/** The subcontractor's meeting history / legal archive, reached from the
 *  Navbar. Shows one card per month; picking a card (`?month=YYYY-MM`, so the
 *  browser Back button returns to the cards) lists that month's completed
 *  talks with a signed-PDF button each. Free plans only see the last 30 days
 *  and get an upgrade banner (with a hidden-count once older logs exist); paid
 *  plans see a retention note instead and a live "Download Defense Bundle"
 *  button — every completed log as one indexed ZIP
 *  (docs/sub-defense-bundle-design.md); Free sees the same button disabled. */
export const MeetingHistory = () => {
  const { user, loading } = useAuth();
  const { isOnline } = useOnlineStatus();
  const { limits } = useCurrentUser();
  const { months, hiddenCount, historyDays, isLoading, isError } =
    useMeetingMonths();
  const { downloadBundle, isPending: isDownloadingBundle } = useDownloadOwnBundle();
  const [searchParams, setSearchParams] = useSearchParams();

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

  const monthParam = searchParams.get("month");
  const selectedMonth = isValidMonth(monthParam) ? monthParam : undefined;
  const archiveYears = limits?.archiveYears ?? 0;

  return (
    <StyledPage>
      <StyledHero aria-labelledby="meeting-history-hero-heading">
        <StyledHeroInner>
          <StyledEyebrow>Records</StyledEyebrow>
          <StyledHeadline id="meeting-history-hero-heading">
            Meeting history
          </StyledHeadline>
          <StyledLede>
            Every completed safety talk with its signed PDF, ready for an OSHA
            audit.
          </StyledLede>
        </StyledHeroInner>
      </StyledHero>

      <StyledSection>
        <StyledContainer>
          {historyDays !== null && (
            <StyledUpgradeBanner>
              <StyledUpgradeTitle>
                {hiddenCount > 0
                  ? `${hiddenCount} older ${
                      hiddenCount === 1 ? "meeting is" : "meetings are"
                    } hidden on the free plan`
                  : `Free plan: meetings are viewable for ${historyDays} days`}
              </StyledUpgradeTitle>
              <StyledUpgradeBody>
                Protect your business during an OSHA audit.{" "}
                <Link to="/pricing">Upgrade to Trade Pro</Link> to unlock your
                full 5-year legal cloud archive.
              </StyledUpgradeBody>
            </StyledUpgradeBanner>
          )}
          {archiveYears > 0 && (
            <StyledRetentionNote>
              Your meeting records are kept for {archiveYears} years.
            </StyledRetentionNote>
          )}

          <StyledBundleRow>
            {archiveYears > 0 ? (
              <Button
                variant="outline"
                size="sm"
                disabled={!isOnline}
                loading={isDownloadingBundle}
                leftIcon={<HiOutlineDownload />}
                onClick={() => downloadBundle()}
                aria-label="Download your OSHA Defense Bundle"
                title="Download your OSHA Defense Bundle"
              >
                Download Defense Bundle
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<HiOutlineDownload />}
                disabled={true}
                aria-label="Download your OSHA Defense Bundle"
              >
                Download Defense Bundle
              </Button>
            )}
          </StyledBundleRow>

          {selectedMonth ? (
            <MonthMeetings
              month={selectedMonth}
              onBack={() => setSearchParams({})}
            />
          ) : (
            <>
              {isLoading && <Spinner center message="Loading your meetings…" />}
              {isError && (
                <StyledError role="alert">
                  Could not load your meetings. Refresh to try again.
                </StyledError>
              )}
              {!isLoading && !isError && (
                <MonthCards
                  months={months}
                  onSelect={(month) => setSearchParams({ month })}
                />
              )}
            </>
          )}
        </StyledContainer>
      </StyledSection>

      <Footer />

      <ProgressModal
        isOpen={isDownloadingBundle}
        title="Preparing your Defense Bundle"
        message="Zipping up your meeting logs and PDFs — this can take a minute or two if you have a lot of history. Please don't close this tab."
      />
    </StyledPage>
  );
};
