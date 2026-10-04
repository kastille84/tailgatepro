import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { HiCheck } from "react-icons/hi2";

import { useAuth } from "../../context/auth";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { SegmentedToggle } from "../../ui_comps/segmented-toggle";
import { Footer } from "../../ui_comps/footer";
import { SUB_PLANS, GC_PLANS } from "../../data/plans";
import {
  NO_INSTALL_ANSWER,
  NO_PER_USER_FEES_BODY,
  NO_PER_USER_FEES_TITLE,
  SPONSORED_ACCESS_ANSWER,
  SPONSORED_ACCESS_QUESTION,
} from "../../data/sharedCopy";
import { planCadence } from "../../utils/pricing";
import { getPlanCtas } from "../../utils/pricingCtas";
import type { Audience, Billing } from "../../interfaces/plan";
import {
  StyledPage,
  StyledHero,
  StyledHeroInner,
  StyledEyebrow,
  StyledHeadline,
  StyledLede,
  StyledSection,
  StyledContainer,
  StyledControls,
  StyledSaveHint,
  StyledPlanGrid,
  StyledPlanCard,
  StyledBadge,
  StyledPlanName,
  StyledPlanTarget,
  StyledPriceRow,
  StyledPrice,
  StyledPricePrefix,
  StyledPriceCadence,
  StyledPriceSub,
  StyledFeatureList,
  StyledInherits,
  StyledFeatureItem,
  StyledSoonTag,
  StyledPlanCtaGroup,
  StyledPlanCta,
  StyledCallout,
  StyledCalloutTitle,
  StyledCalloutText,
  StyledSectionHead,
  StyledSectionTitle,
  StyledSectionLede,
  StyledFaq,
  StyledFaqItem,
  StyledFaqQuestion,
  StyledFaqAnswer,
} from "./Pricing.styles";

const AUDIENCE_OPTIONS: { value: Audience; label: string }[] = [
  { value: "sub", label: "For subcontractors" },
  { value: "gc", label: "For general contractors" },
];

const BILLING_OPTIONS: { value: Billing; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "annual", label: "Annual" },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "Do my sub-foremen need to download an app from the App Store?",
    a: NO_INSTALL_ANSWER,
  },
  {
    q: "What happens to my safety logs on the Trade Free plan after 30 days?",
    a: "Every completed talk is emailed to your GC as a PDF link that stays valid for 30 days; after that, your GC can sign in to open a fresh link. The Free plan's in-app history shows the last 30 days; Trade Pro adds the 5-year legal cloud archive.",
  },
  {
    q: SPONSORED_ACCESS_QUESTION,
    a: SPONSORED_ACCESS_ANSWER,
  },
  {
    q: "What's the difference between GC Site Pro and GC Portfolio?",
    a: "GC Site Pro covers a single jobsite at $149/site/mo. GC Portfolio is flat-rate multi-site — $499/mo for up to 10 sites, $799/mo unlimited — and adds multi-manager roles (assign Superintendents to specific job sites; Safety Directors and Admins still see every site), cross-project subcontractor safety scorecards, and top-down corporate policy push (push a mandatory safety topic across every active site at once). Already paying for Site Pro sites? Switching to GC Portfolio covers them all, cancels the per-site subscriptions right away and credits the unused time.",
  },
  {
    q: "When can I actually sign up?",
    a: "Right now. Start on a free plan, or pick Trade Pro, Trade Enterprise or GC Portfolio and we'll take you through sign-up to secure checkout. GC Site Pro is bought per jobsite: sign up, open your job sites and choose Upgrade to Site Pro on the site you want.",
  },
];

export const Pricing = () => {
  const [searchParams] = useSearchParams();

  const [audience, setAudience] = useState<Audience>(
    searchParams.get("audience") === "gc" ? "gc" : "sub",
  );
  const [billing, setBilling] = useState<Billing>("monthly");
  const { user } = useAuth();
  const { companyType, isManagerRole, plan: currentPlanId } = useCurrentUser();

  const plans = audience === "sub" ? SUB_PLANS : GC_PLANS;

  return (
    <StyledPage>
      <StyledHero aria-labelledby="pricing-hero-heading">
        <StyledHeroInner>
          <StyledEyebrow>Pricing</StyledEyebrow>
          <StyledHeadline id="pricing-hero-heading">
            Safety compliance built for the field.{" "}
            <span>Crews start free.</span>
          </StyledHeadline>
          <StyledLede>
            No app-store downloads. Run offline toolbox talks, collect
            on-screen signatures, and send automated compliance logs to any GC
            before the crew gears up. Subcontractors can start free — general
            contractors pay a flat rate per active jobsite or portfolio.
          </StyledLede>
        </StyledHeroInner>
      </StyledHero>

      <StyledSection aria-labelledby="plans-heading">
        <StyledContainer>
          <StyledSectionHead>
            <StyledSectionTitle id="plans-heading">
              Choose the plan that fits your role
            </StyledSectionTitle>
            <StyledSectionLede>
              Subcontractors and general contractors get different tools. Pick
              your side to see the plans built for it.
            </StyledSectionLede>
          </StyledSectionHead>

          <StyledControls>
            <SegmentedToggle<Audience>
              options={AUDIENCE_OPTIONS}
              value={audience}
              onChange={setAudience}
              ariaLabel="Choose your audience"
            />
            <SegmentedToggle<Billing>
              options={BILLING_OPTIONS}
              value={billing}
              onChange={setBilling}
              ariaLabel="Choose a billing period"
            />
            <StyledSaveHint>Annual = 2 months free</StyledSaveHint>
          </StyledControls>

          <StyledPlanGrid>
            {plans.map((plan) => {
              const cadence = planCadence(plan, billing);
              return (
                <StyledPlanCard key={plan.id} $featured={plan.featured}>
                  {plan.featured && <StyledBadge>Recommended</StyledBadge>}
                  <StyledPlanName>{plan.name}</StyledPlanName>
                  <StyledPlanTarget>{plan.target}</StyledPlanTarget>

                  <StyledPriceRow>
                    {plan.pricePrefix && (
                      <StyledPricePrefix>{plan.pricePrefix}</StyledPricePrefix>
                    )}
                    <StyledPrice>{plan.price[billing]}</StyledPrice>
                    {cadence && (
                      <StyledPriceCadence>{cadence}</StyledPriceCadence>
                    )}
                  </StyledPriceRow>
                  <StyledPriceSub>
                    {billing === "annual" && plan.annualSub
                      ? plan.annualSub
                      : " "}
                  </StyledPriceSub>

                  {plan.inheritsFrom && (
                    <StyledInherits>
                      Everything in {plan.inheritsFrom}, plus:
                    </StyledInherits>
                  )}
                  <StyledFeatureList>
                    {plan.features.map((feature) => (
                      <StyledFeatureItem key={feature}>
                        <HiCheck aria-hidden="true" />
                        <span>
                          {feature}
                          {plan.comingSoon?.includes(feature) && (
                            <StyledSoonTag>Coming soon</StyledSoonTag>
                          )}
                        </span>
                      </StyledFeatureItem>
                    ))}
                  </StyledFeatureList>

                  <StyledPlanCtaGroup>
                    {getPlanCtas(plan.id, {
                      signedIn: !!user,
                      companyType,
                      isManager: isManagerRole,
                      currentPlanId,
                      billing,
                    }).map((cta) => {
                      if (cta.disabled) {
                        return (
                          <StyledPlanCta
                            key={cta.label}
                            as="span"
                            aria-disabled="true"
                            $disabled
                            $featured={plan.featured}
                          >
                            {cta.label}
                          </StyledPlanCta>
                        );
                      }
                      return (
                        <StyledPlanCta
                          key={cta.label}
                          as={Link}
                          to={cta.to}
                          $featured={plan.featured}
                        >
                          {cta.label}
                        </StyledPlanCta>
                      );
                    })}
                  </StyledPlanCtaGroup>
                </StyledPlanCard>
              );
            })}
          </StyledPlanGrid>

          <StyledCallout>
            <StyledCalloutTitle>{NO_PER_USER_FEES_TITLE}</StyledCalloutTitle>
            <StyledCalloutText>
              {NO_PER_USER_FEES_BODY.map(({ text, strong }) =>
                strong ? <strong key={text}>{text}</strong> : text,
              )}
            </StyledCalloutText>
          </StyledCallout>
        </StyledContainer>
      </StyledSection>

      <StyledSection aria-labelledby="faq-heading">
        <StyledContainer>
          <StyledSectionHead>
            <StyledSectionTitle id="faq-heading">
              Common questions
            </StyledSectionTitle>
          </StyledSectionHead>
          <StyledFaq>
            {FAQ.map(({ q, a }) => (
              <StyledFaqItem key={q}>
                <StyledFaqQuestion>{q}</StyledFaqQuestion>
                <StyledFaqAnswer>{a}</StyledFaqAnswer>
              </StyledFaqItem>
            ))}
          </StyledFaq>
        </StyledContainer>
      </StyledSection>

      <Footer />
    </StyledPage>
  );
};
