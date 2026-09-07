import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { HiCheck } from "react-icons/hi2";

import { WaitlistForm } from "../Landing/WaitlistForm";
import { SegmentedToggle } from "../../ui_comps/segmented-toggle";
import { Footer } from "../../ui_comps/footer";
import { SUB_PLANS, GC_PLANS } from "../../data/plans";
import { planCadence } from "../../utils/pricing";
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
  StyledSelectedNote,
  StyledPlanGrid,
  StyledPlanCard,
  StyledBadge,
  StyledPlanName,
  StyledPlanTarget,
  StyledPriceRow,
  StyledPrice,
  StyledPriceCadence,
  StyledPriceSub,
  StyledFeatureList,
  StyledFeatureItem,
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
  StyledCtaSection,
  StyledCtaInner,
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
    a: "No. TailgatePro is an offline-first Progressive Web App. Foremen scan a QR code or tap a link to open it straight away in their mobile browser — nothing to install.",
  },
  {
    q: "What happens to my safety logs on the Trade Free plan after 30 days?",
    a: "Emailed PDFs stay in your inbox forever. The in-app dashboard history locks after 30 days; Trade Pro unlocks your full 5-year legal cloud archive.",
  },
  {
    q: "How does a general contractor sponsor subcontractors for free?",
    a: "On GC Site Pro or GC Portfolio you get project-specific QR codes and links. Any trade subcontractor working those sites scans one to log talks under your dashboard at zero cost to them.",
  },
  {
    q: "What's the difference between GC Site Pro and GC Portfolio?",
    a: "GC Site Pro covers a single jobsite at $149/site/mo. GC Portfolio is flat-rate multi-site — $499/mo for up to 10 sites, $799/mo unlimited — and adds cross-project subcontractor safety scorecards, top-down corporate policy push, and multi-manager roles (Superintendent vs Safety Director).",
  },
  {
    q: "When can I actually sign up?",
    a: "We're onboarding subcontractors and general contractors for launch now. Join the waitlist and we'll set you up on the right plan the moment we go live.",
  },
];

const WAITLIST_ANCHOR = "#pricing-waitlist";

export const Pricing = () => {
  const [searchParams] = useSearchParams();

  const [audience, setAudience] = useState<Audience>(
    searchParams.get("audience") === "gc" ? "gc" : "sub",
  );
  const [billing, setBilling] = useState<Billing>("monthly");
  const [selectedPlan, setSelectedPlan] = useState<string | null>(
    searchParams.get("plan"),
  );

  const plans = audience === "sub" ? SUB_PLANS : GC_PLANS;
  const selectedPlanName =
    plans.find((plan) => plan.id === selectedPlan)?.name ?? null;

  const changeAudience = (next: Audience) => {
    setAudience(next);
    setSelectedPlan(null);
  };

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
            tamper-evident signatures, and send automated compliance logs to any
            GC before the crew gears up. Subcontractors can start free — general
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
              onChange={changeAudience}
              ariaLabel="Choose your audience"
            />
            <SegmentedToggle<Billing>
              options={BILLING_OPTIONS}
              value={billing}
              onChange={setBilling}
              ariaLabel="Choose a billing period"
            />
            <StyledSaveHint>Annual saves 20%</StyledSaveHint>
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

                  <StyledFeatureList>
                    {plan.features.map((feature) => (
                      <StyledFeatureItem key={feature}>
                        <HiCheck aria-hidden="true" />
                        <span>{feature}</span>
                      </StyledFeatureItem>
                    ))}
                  </StyledFeatureList>

                  <StyledPlanCta
                    href={WAITLIST_ANCHOR}
                    $featured={plan.featured}
                    onClick={() => setSelectedPlan(plan.id)}
                  >
                    Join the waitlist
                  </StyledPlanCta>
                </StyledPlanCard>
              );
            })}
          </StyledPlanGrid>

          <StyledCallout>
            <StyledCalloutTitle>Zero subcontractor seat tax</StyledCalloutTitle>
            <StyledCalloutText>
              Legacy platforms charge per user seat, penalizing you for adding
              trade subcontractors to your project. With{" "}
              <strong>GC Site Pro</strong> or <strong>GC Portfolio</strong> you
              pay a flat rate per site or portfolio, and{" "}
              <strong>
                every subcontractor on your job gets full access for $0
              </strong>{" "}
              — no app-store downloads, no user-billing disputes, 100% site
              compliance on day one.
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

      <StyledCtaSection
        id="pricing-waitlist"
        aria-labelledby="pricing-cta-heading"
      >
        <StyledCtaInner>
          <StyledSectionTitle id="pricing-cta-heading">
            Lock in your plan for launch
          </StyledSectionTitle>
          <StyledSectionLede>
            Pricing goes live when we launch. Join the waitlist and we&apos;ll
            be in touch to get you set up on the plan you picked.
          </StyledSectionLede>
          {selectedPlanName && (
            <StyledSelectedNote>
              Selected plan: <strong>{selectedPlanName}</strong>
            </StyledSelectedNote>
          )}
          <WaitlistForm
            idPrefix="pricing"
            tone="onDark"
            audience={audience}
            planInterest={selectedPlan ?? undefined}
          />
        </StyledCtaInner>
      </StyledCtaSection>
      <Footer />
    </StyledPage>
  );
};
