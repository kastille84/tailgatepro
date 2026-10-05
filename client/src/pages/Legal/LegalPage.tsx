import type { ReactNode } from "react";

import { Footer } from "../../ui_comps/footer";
import {
  StyledPage,
  StyledHero,
  StyledEyebrow,
  StyledHeadline,
  StyledUpdated,
  StyledContent,
  StyledSection,
  StyledSectionHeading,
} from "./LegalPage.styles";

export const SUPPORT_EMAIL = "support@gettailgatepro.com";
export const LEGAL_ENTITY = "Edwin Edgardo Martinez, doing business as TailgatePro";
export const LEGAL_LAST_UPDATED = "October 5, 2026";

interface LegalPageProps {
  title: string;
  children: ReactNode;
}

interface LegalSectionProps {
  heading: string;
  children: ReactNode;
}

export const LegalSection = ({ heading, children }: LegalSectionProps) => (
  <StyledSection>
    <StyledSectionHeading>{heading}</StyledSectionHeading>
    {children}
  </StyledSection>
);

export const LegalPage = ({ title, children }: LegalPageProps) => (
  <StyledPage>
    <StyledHero>
      <StyledEyebrow>TailgatePro</StyledEyebrow>
      <StyledHeadline>{title}</StyledHeadline>
      <StyledUpdated>Last updated: {LEGAL_LAST_UPDATED}</StyledUpdated>
    </StyledHero>
    <StyledContent>{children}</StyledContent>
    <Footer />
  </StyledPage>
);
