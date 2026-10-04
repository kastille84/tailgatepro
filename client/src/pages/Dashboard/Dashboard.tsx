import {
  HiBookOpen,
  HiBuildingOffice2,
  HiClipboardDocumentList,
  HiShieldCheck,
} from "react-icons/hi2";

import { useAuth } from "../../context/auth";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { GcDashboard } from "../GcDashboard";
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
  StyledCardIconContainer,
} from "./Dashboard.styles";

/** The authenticated hub. GC users land on their compliance view (the same
 *  content as `/gc`) instead of the generic card grid — that's their primary
 *  landing experience, not something to click through to. Everyone else sees
 *  entry-point cards for the product areas; only Projects is live today, the
 *  rest are "coming soon" placeholders. Reached only through the RequireAuth
 *  route guard, but stays defensive on its own. */
export const Dashboard = () => {
  const { user, loading /*logout*/ } = useAuth();
  const { isGc, isLoading: isCurrentUserLoading } = useCurrentUser();
  // const [isLoggingOut, setIsLoggingOut] = useState(false);

  // const handleLogout = async () => {
  //   setIsLoggingOut(true);
  //   try {
  //     await logout();
  //   } finally {
  //     setIsLoggingOut(false);
  //   }
  // };

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

  if (isCurrentUserLoading) {
    return (
      <StyledPage>
        <StyledStatus role="status" aria-live="polite">
          Loading your dashboard…
        </StyledStatus>
      </StyledPage>
    );
  }

  if (isGc) {
    return <GcDashboard />;
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
          {/* <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            loading={isLoggingOut}
          >
            Logout
          </Button> */}
        </StyledHeroInner>
      </StyledHero>

      <StyledSection>
        <StyledContainer>
          <StyledCardGrid>
            <StyledCard to="/projects">
              <StyledCardIconContainer>
                <HiBuildingOffice2
                  size={22}
                  color="var(--color-orange-600)"
                  aria-hidden="true"
                />
              </StyledCardIconContainer>
              <StyledCardTitle>Projects</StyledCardTitle>
              <StyledCardText>
                Manage your job sites and the GCs you report to.
              </StyledCardText>
            </StyledCard>
            <StyledCard to="/talks">
              <StyledCardIconContainer>
                <HiBookOpen
                  size={22}
                  color="var(--color-navy-600)"
                  aria-hidden="true"
                />
              </StyledCardIconContainer>
              <StyledCardTitle>Toolbox Talks</StyledCardTitle>
              <StyledCardText>
                Browse the OSHA safety-talk library.
              </StyledCardText>
            </StyledCard>
            <StyledCard to="/meetings/new">
              <StyledCardIconContainer>
                <HiClipboardDocumentList
                  size={22}
                  color="var(--color-green-700)"
                  aria-hidden="true"
                />
              </StyledCardIconContainer>
              <StyledCardTitle>Meeting Logs</StyledCardTitle>
              <StyledCardText>
                Start a toolbox talk and collect signatures.
              </StyledCardText>
            </StyledCard>
            {/* Only non-GC viewers ever reach this card — a GC lands on
                GcDashboard above instead. */}
            <StyledCardSoon aria-disabled="true">
              <StyledCardIconContainer>
                <HiShieldCheck
                  size={22}
                  color="var(--color-red-500)"
                  aria-hidden="true"
                />
              </StyledCardIconContainer>
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
