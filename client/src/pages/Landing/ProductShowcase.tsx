import {
  StyledSection,
  StyledContainer,
  StyledSectionHead,
  StyledSectionTitle,
  StyledSectionLede,
} from "./Landing.styles";
import { PhoneMockup } from "./PhoneMockup";
import { CompliancePdfCard } from "./CompliancePdfCard";
import {
  StyledShowcase,
  StyledShowcaseItem,
  StyledCaption,
} from "./ProductShowcase.styles";

export const ProductShowcase = () => (
  <StyledSection $tone="dark" aria-labelledby="showcase-heading">
    <StyledContainer>
      <StyledSectionHead>
        <StyledSectionTitle id="showcase-heading">
          See it the way the crew does
        </StyledSectionTitle>
        <StyledSectionLede>
          The whole talk lives on one screen. The GC gets a signed, GPS-verified
          PDF — not a shoebox of paper.
        </StyledSectionLede>
      </StyledSectionHead>

      <StyledShowcase>
        <StyledShowcaseItem>
          <PhoneMockup
            tone="dark"
            screen="topics"
            label="The talk screen on a phone: today's topic list with Fall Protection selected."
          />
          <StyledCaption>Pick today&apos;s topic</StyledCaption>
        </StyledShowcaseItem>

        <StyledShowcaseItem>
          <PhoneMockup
            tone="dark"
            screen="signature"
            label="The sign-off screen on a phone: crew members signing their names one by one."
          />
          <StyledCaption>Crew signs on-screen</StyledCaption>
        </StyledShowcaseItem>

        <StyledShowcaseItem>
          <PhoneMockup
            tone="dark"
            screen="submitted"
            label="The confirmation screen on a phone: talk submitted and synced to the general contractor."
          />
          <StyledCaption>Submitted — synced to the GC</StyledCaption>
        </StyledShowcaseItem>

        <StyledShowcaseItem>
          <CompliancePdfCard />
          <StyledCaption>What the GC receives</StyledCaption>
        </StyledShowcaseItem>
      </StyledShowcase>
    </StyledContainer>
  </StyledSection>
);
