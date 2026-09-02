import { useState } from "react";
import { HiCheck, HiArrowRight } from "react-icons/hi2";

import { SegmentedToggle } from "../../ui_comps/segmented-toggle";
import { SUB_PLANS, GC_PLANS } from "../../data/plans";
import { planCadence } from "../../utils/pricing";
import type { Audience } from "../../interfaces/plan";
import {
  StyledSection,
  StyledContainer,
  StyledSectionHead,
  StyledSectionTitle,
  StyledSectionLede,
} from "./Landing.styles";
import {
  StyledControls,
  StyledGrid,
  StyledCard,
  StyledBadge,
  StyledName,
  StyledPriceRow,
  StyledPrice,
  StyledCadence,
  StyledTarget,
  StyledFeatures,
  StyledFeatureItem,
  StyledMore,
  StyledMoreLink,
} from "./PricingTeaser.styles";

const AUDIENCE_OPTIONS: { value: Audience; label: string }[] = [
  { value: "sub", label: "For subcontractors" },
  { value: "gc", label: "For general contractors" },
];

/** Compact pricing preview on the homepage. Full detail lives on /pricing. */
export const PricingTeaser = () => {
  const [audience, setAudience] = useState<Audience>("sub");
  const plans = audience === "sub" ? SUB_PLANS : GC_PLANS;

  return (
    <StyledSection $tone="light" aria-labelledby="pricing-teaser-heading">
      <StyledContainer>
        <StyledSectionHead>
          <StyledSectionTitle id="pricing-teaser-heading">
            Pricing built around the jobsite
          </StyledSectionTitle>
          <StyledSectionLede>
            Every crew uses TailgatePro free. General contractors pay a flat rate
            per active site or portfolio — no per-seat fees, no sub-billing
            disputes.
          </StyledSectionLede>
        </StyledSectionHead>

        <StyledControls>
          <SegmentedToggle<Audience>
            options={AUDIENCE_OPTIONS}
            value={audience}
            onChange={setAudience}
            ariaLabel="Choose your audience"
          />
        </StyledControls>

        <StyledGrid>
          {plans.map((plan) => {
            const cadence = planCadence(plan, "monthly");
            return (
              <StyledCard key={plan.id} $featured={plan.featured}>
                {plan.featured && <StyledBadge>Recommended</StyledBadge>}
                <StyledName>{plan.name}</StyledName>
                <StyledPriceRow>
                  <StyledPrice>{plan.price.monthly}</StyledPrice>
                  {cadence && <StyledCadence>{cadence}</StyledCadence>}
                </StyledPriceRow>
                <StyledTarget>{plan.target}</StyledTarget>
                <StyledFeatures>
                  {plan.features.slice(0, 3).map((feature) => (
                    <StyledFeatureItem key={feature}>
                      <HiCheck aria-hidden="true" />
                      <span>{feature}</span>
                    </StyledFeatureItem>
                  ))}
                </StyledFeatures>
              </StyledCard>
            );
          })}
        </StyledGrid>

        <StyledMore>
          <StyledMoreLink to={`/pricing?audience=${audience}`}>
            See full plan details &amp; annual pricing
            <HiArrowRight aria-hidden="true" />
          </StyledMoreLink>
        </StyledMore>
      </StyledContainer>
    </StyledSection>
  );
};
