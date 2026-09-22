import { Link } from "react-router-dom";

import { useAuth } from "../../context/auth";
import { useCompanyLogo } from "../../hooks/useCompanyLogo";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { useJoinCode } from "../../hooks/useJoinCode";
import { useUploadCompanyLogo } from "../../hooks/useUploadCompanyLogo";
import { Footer } from "../../ui_comps/footer";
import { JoinCodeCard, LogoUpload } from "../../features/company-settings";
import {
  StyledSection as StyledLogoSection,
  StyledSectionTitle,
  StyledUpsell,
  StyledUpsellBody,
  StyledUpsellTitle,
} from "../../features/company-settings/styles";
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
} from "./Settings.styles";

/** The authenticated account/company Settings page, reached from the Navbar.
 *  Renders for every signed-in user; only the logo-upload control within it
 *  is tier-gated (Trade Pro+), so the page itself stays a general home for
 *  future non-branding settings. Re-checks the session defensively even
 *  though it sits behind `RequireAuth`, matching `Projects.tsx`. */
export const Settings = () => {
  const { user, loading } = useAuth();
  const { hasBrandingAccess, isGc } = useCurrentUser();
  const { joinCode, isLoading: isJoinCodeLoading, isError: isJoinCodeError } =
    useJoinCode();
  const { logoUrl } = useCompanyLogo();
  const { uploadLogo, isUploading } = useUploadCompanyLogo();

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
      <StyledHero aria-labelledby="settings-hero-heading">
        <StyledHeroInner>
          <StyledEyebrow>Settings</StyledEyebrow>
          <StyledHeadline id="settings-hero-heading">
            Company settings
          </StyledHeadline>
          <StyledLede>Manage how your company shows up on the job.</StyledLede>
        </StyledHeroInner>
      </StyledHero>

      <StyledSection>
        <StyledContainer>
          <StyledLogoSection>
            <StyledSectionTitle>Company logo</StyledSectionTitle>
            {hasBrandingAccess ? (
              <LogoUpload
                currentLogoUrl={logoUrl}
                isUploading={isUploading}
                onUpload={uploadLogo}
              />
            ) : (
              <StyledUpsell>
                <StyledUpsellTitle>
                  {isGc
                    ? "Custom branding is a GC Site Pro feature"
                    : "Custom branding is a Trade Pro feature"}
                </StyledUpsellTitle>
                <StyledUpsellBody>
                  Upload your company logo and remove the free-plan watermark
                  from every generated PDF report —{" "}
                  <Link to="/pricing">
                    upgrade to {isGc ? "GC Site Pro" : "Trade Pro"}
                  </Link>{" "}
                  to unlock it.
                </StyledUpsellBody>
              </StyledUpsell>
            )}
          </StyledLogoSection>

          {isGc && (
            <StyledLogoSection>
              <StyledSectionTitle>Subcontractor join code</StyledSectionTitle>
              <JoinCodeCard
                joinCode={joinCode}
                isLoading={isJoinCodeLoading}
                isError={isJoinCodeError}
              />
            </StyledLogoSection>
          )}
        </StyledContainer>
      </StyledSection>

      <Footer />
    </StyledPage>
  );
};
