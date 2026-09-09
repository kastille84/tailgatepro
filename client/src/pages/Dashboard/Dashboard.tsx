import { useState } from "react";

import { useAuth } from "../../context/auth";
import { Button } from "../../ui_comps/button";
import { Footer } from "../../ui_comps/footer";
import {
  StyledPage,
  StyledHero,
  StyledHeroInner,
  StyledEyebrow,
  StyledHeadline,
  StyledLede,
  StyledSection,
  StyledContainer,
  StyledCardGrid,
  StyledCard,
  StyledCardSoon,
  StyledCardTitle,
  StyledCardText,
  StyledStatus,
} from "./Dashboard.styles";

/** The authenticated hub. Renders entry-point cards for the product areas;
 *  only Projects is live today, the rest are "coming soon" placeholders. Reached
 *  only through the RequireAuth route guard, but stays defensive on its own. */
export const Dashboard = () => {
  const { user, loading, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (loading) {
    return (
      <StyledPage>
        <StyledStatus role="status" aria-live="polite">
          Loading your dashboard…
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
      <StyledHero aria-labelledby="dashboard-hero-heading">
        <StyledHeroInner>
          <StyledEyebrow>Dashboard</StyledEyebrow>
          <StyledHeadline id="dashboard-hero-heading">
            Welcome back
          </StyledHeadline>
          <StyledLede>
            Signed in as <strong>{user.email}</strong>
          </StyledLede>
          <Button
            variant="outline"
            size="md"
            onClick={handleLogout}
            loading={isLoggingOut}
          >
            Logout
          </Button>
        </StyledHeroInner>
      </StyledHero>

      <StyledSection>
        <StyledContainer>
          <StyledCardGrid>
            <StyledCard to="/projects">
              <StyledCardTitle>Projects</StyledCardTitle>
              <StyledCardText>
                Manage your job sites and the GCs you report to.
              </StyledCardText>
            </StyledCard>
            <StyledCardSoon aria-disabled="true">
              <StyledCardTitle>Toolbox Talks</StyledCardTitle>
              <StyledCardText>
                Browse the OSHA safety-talk library. Coming soon.
              </StyledCardText>
            </StyledCardSoon>
            <StyledCardSoon aria-disabled="true">
              <StyledCardTitle>Meeting Logs</StyledCardTitle>
              <StyledCardText>
                Review and sync completed talks. Coming soon.
              </StyledCardText>
            </StyledCardSoon>
            <StyledCardSoon aria-disabled="true">
              <StyledCardTitle>GC Compliance</StyledCardTitle>
              <StyledCardText>
                Audit subcontractor safety logs. Coming soon.
              </StyledCardText>
            </StyledCardSoon>
          </StyledCardGrid>
        </StyledContainer>
      </StyledSection>

      <Footer />
    </StyledPage>
  );
};
