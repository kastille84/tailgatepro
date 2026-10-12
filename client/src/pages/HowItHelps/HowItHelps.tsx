import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { HiMinusCircle } from "react-icons/hi2";

import { SegmentedToggle } from "../../ui_comps/segmented-toggle";
import { ButtonLink } from "../../ui_comps/button";
import { Footer } from "../../ui_comps/footer";
import {
  NO_PER_USER_FEES_BODY,
  NO_PER_USER_FEES_TITLE,
} from "../../data/sharedCopy";
import { CompliancePdfCard } from "../Landing/CompliancePdfCard";
import { GcDashboardMockup } from "../Landing/GcDashboardMockup";
import { PhoneMockup } from "../Landing/PhoneMockup";
import {
  StyledPage,
  StyledHero,
  StyledHeroCopy,
  StyledEyebrow,
  StyledHeadline,
  StyledLede,
  StyledHeroSecondaryCta,
  StyledSection,
  StyledContainer,
  StyledSectionHead,
  StyledSectionTitle,
  StyledSectionLede,
  StyledCtaInner,
} from "../Landing/Landing.styles";
import {
  StyledCallout,
  StyledCalloutTitle,
  StyledCalloutText,
} from "../Landing/GcSection.styles";
import {
  AUDIENCE_CONTENT,
  AUDIENCE_OPTIONS,
  LIMITS,
  HELP_CELL_HEADING,
  METER_LEVELS,
  STRENGTH_LABEL,
  STRENGTH_LEVEL,
  TIMELINE_STEPS,
} from "./HowItHelpsContent";
import type { HelpAudience } from "./HowItHelpsContent";
import {
  StyledHeroToggle,
  StyledToggleHint,
  StyledPanel,
  StyledPanelHead,
  StyledPanelEyebrow,
  StyledPanelTitle,
  StyledPanelLede,
  StyledFear,
  StyledFearLabel,
  StyledFearQuote,
  StyledFearBody,
  StyledPitchLayout,
  StyledVisuals,
  StyledPitchList,
  StyledPitch,
  StyledPitchBody,
  StyledPitchTitle,
  StyledPitchText,
  StyledTimeline,
  StyledStep,
  StyledStepWhen,
  StyledStepNumber,
  StyledStepTime,
  StyledStepWhat,
  StyledStepMatters,
  StyledHelpHeading,
  StyledStrengthRow,
  StyledStrengthTag,
  StyledStrengthMeter,
  StyledMeterDot,
  StyledLimits,
  StyledLimitItem,
  StyledDisclaimer,
  StyledCtaLinks,
} from "./HowItHelps.styles";

const PAGE_TITLE = "How TailgatePro Helps";

export const HowItHelps = () => {
  const [searchParams] = useSearchParams();
  const [audience, setAudience] = useState<HelpAudience>(
    searchParams.get("audience") === "sub" ? "sub" : "gc",
  );
  const content = AUDIENCE_CONTENT[audience];

  useEffect(() => {
    const previousTitle = document.title;
    document.title = PAGE_TITLE;
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <StyledPage>
      <StyledHero aria-labelledby="how-it-helps-heading">
        <StyledContainer>
          <StyledHeroCopy>
            <StyledEyebrow>How TailgatePro helps</StyledEyebrow>
            <StyledHeadline id="how-it-helps-heading">
              When something goes wrong,{" "}
              <span>the record is what protects you.</span>
            </StyledHeadline>
            <StyledLede>
              After a jobsite accident, OSHA, insurers and lawyers all ask the
              same early question: show me the training, and show me who was
              there. TailgatePro makes sure you can.
            </StyledLede>
            <StyledHeroToggle>
              <SegmentedToggle<HelpAudience>
                options={AUDIENCE_OPTIONS}
                value={audience}
                onChange={setAudience}
                ariaLabel="Choose your role"
              />
              <StyledToggleHint>
                Tap your role to see what it means for you.
              </StyledToggleHint>
            </StyledHeroToggle>
          </StyledHeroCopy>
        </StyledContainer>
      </StyledHero>

      <StyledSection $tone="light" aria-labelledby="audience-heading">
        <StyledContainer>
          <StyledPanel key={audience}>
            <StyledPanelHead>
              <StyledPanelEyebrow>{content.eyebrow}</StyledPanelEyebrow>
              <StyledPanelTitle id="audience-heading">
                {content.heading}
              </StyledPanelTitle>
              <StyledPanelLede>{content.lede}</StyledPanelLede>
            </StyledPanelHead>

            <StyledFear aria-label={content.fear.label}>
              <StyledFearLabel>{content.fear.label}</StyledFearLabel>
              <StyledFearQuote>{content.fear.quote}</StyledFearQuote>
              <StyledFearBody>{content.fear.body}</StyledFearBody>
            </StyledFear>

            <StyledPitchLayout>
              <StyledVisuals>
                {audience === "gc" ? (
                  <GcDashboardMockup tone="light" />
                ) : (
                  <>
                    <PhoneMockup
                      screen="signature"
                      tone="light"
                      label="Example phone screen — a crew signing off on a toolbox talk with finger signatures."
                    />
                    <CompliancePdfCard />
                  </>
                )}
              </StyledVisuals>

              <StyledPitchList>
                {content.pitches.map(({ title, body }) => (
                  <StyledPitch key={title}>
                    <StyledPitchBody>
                      <StyledPitchTitle>{title}</StyledPitchTitle>
                      <StyledPitchText>{body}</StyledPitchText>
                    </StyledPitchBody>
                  </StyledPitch>
                ))}
              </StyledPitchList>
            </StyledPitchLayout>

            {audience === "gc" && (
              <StyledCallout>
                <StyledCalloutTitle>
                  {NO_PER_USER_FEES_TITLE}
                </StyledCalloutTitle>
                <StyledCalloutText>
                  {NO_PER_USER_FEES_BODY.map(({ text, strong }) =>
                    strong ? <strong key={text}>{text}</strong> : text,
                  )}
                </StyledCalloutText>
              </StyledCallout>
            )}
          </StyledPanel>
        </StyledContainer>
      </StyledSection>

      <StyledSection $tone="muted" aria-labelledby="timeline-heading">
        <StyledContainer>
          <StyledSectionHead>
            <StyledEyebrow as="p">After an accident</StyledEyebrow>
            <StyledSectionTitle id="timeline-heading">
              What happens next, and how TailgatePro helps
            </StyledSectionTitle>
            <StyledSectionLede>
              The same sequence plays out for every serious incident. Each step
              shows how much TailgatePro helps.
            </StyledSectionLede>
          </StyledSectionHead>

          <StyledTimeline>
            {TIMELINE_STEPS.map((step, index) => (
              <StyledStep key={step.title}>
                <StyledStepWhen>
                  <StyledStepNumber>Step {index + 1}</StyledStepNumber>
                  <StyledStepTime>{step.when}</StyledStepTime>
                </StyledStepWhen>
                <StyledStepWhat>
                  <StyledPitchTitle>{step.title}</StyledPitchTitle>
                  <StyledPitchText>{step.happens}</StyledPitchText>
                </StyledStepWhat>
                <StyledStepMatters $strength={step.strength}>
                  <StyledHelpHeading>{HELP_CELL_HEADING}</StyledHelpHeading>
                  <StyledStrengthRow>
                    <StyledStrengthTag>
                      {STRENGTH_LABEL[step.strength]}
                    </StyledStrengthTag>
                    <StyledStrengthMeter aria-hidden="true">
                      {METER_LEVELS.map((level) => (
                        <StyledMeterDot
                          key={level}
                          $filled={level <= STRENGTH_LEVEL[step.strength]}
                        />
                      ))}
                    </StyledStrengthMeter>
                  </StyledStrengthRow>
                  <StyledPitchText>{step.matters}</StyledPitchText>
                </StyledStepMatters>
              </StyledStep>
            ))}
          </StyledTimeline>
        </StyledContainer>
      </StyledSection>

      <StyledSection $tone="light" aria-labelledby="limits-heading">
        <StyledContainer>
          <StyledSectionHead>
            <StyledSectionTitle id="limits-heading">
              What TailgatePro doesn&apos;t do
            </StyledSectionTitle>
            <StyledSectionLede>
              We would rather you know the limits up front.
            </StyledSectionLede>
          </StyledSectionHead>
          <StyledLimits>
            {LIMITS.map((limit) => (
              <StyledLimitItem key={limit}>
                <HiMinusCircle aria-hidden="true" />
                <span>{limit}</span>
              </StyledLimitItem>
            ))}
          </StyledLimits>
          <StyledDisclaimer>
            General information, not legal advice. Talk to your attorney about
            your own contracts and obligations.
          </StyledDisclaimer>
        </StyledContainer>
      </StyledSection>

      <StyledSection $tone="dark" aria-labelledby="how-cta-heading">
        <StyledCtaInner>
          <StyledSectionTitle id="how-cta-heading">
            {content.cta.heading}
          </StyledSectionTitle>
          <StyledSectionLede>{content.cta.lede}</StyledSectionLede>
          <StyledCtaLinks>
            <ButtonLink to="/signup" size="lg">
              {content.cta.button}
            </ButtonLink>
            <StyledHeroSecondaryCta to="/pricing" variant="outline" size="lg">
              See pricing
            </StyledHeroSecondaryCta>
          </StyledCtaLinks>
        </StyledCtaInner>
      </StyledSection>

      <Footer />
    </StyledPage>
  );
};
