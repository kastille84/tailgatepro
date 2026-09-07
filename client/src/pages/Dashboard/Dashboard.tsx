import { useState } from "react";

import { useAuth } from "../../context/auth";
import { Button } from "../../ui_comps/button";
import {
  StyledPage,
  StyledHero,
  StyledHeroInner,
  StyledEyebrow,
  StyledHeadline,
  StyledLede,
  StyledSection,
  StyledContainer,
  StyledPlaceholder,
  StyledStatus,
} from "./Dashboard.styles";

/** Minimal authenticated shell — a placeholder for future product features
 *  (toolbox talks, meeting logs, the GC dashboard) to attach to. Reached only
 *  through the RequireAuth route guard, but stays defensive on its own. */
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
          <StyledPlaceholder>
            Toolbox talks, meeting logs, and your GC dashboard will live here
            soon.
          </StyledPlaceholder>
        </StyledContainer>
      </StyledSection>
    </StyledPage>
  );
};
