import {
  HiExclamationTriangle,
  HiMagnifyingGlass,
  HiClock,
  HiSun,
  HiSignalSlash,
  HiCheck,
  HiLink,
  HiDocumentCheck,
} from "react-icons/hi2";
import type { IconType } from "react-icons";
import { Link } from "react-router-dom";

import { ButtonLink } from "../../ui_comps/button";
import { PricingTeaser } from "./PricingTeaser";
import { HowItWorks } from "./HowItWorks";
import { ProductShowcase } from "./ProductShowcase";
import { GcSection } from "./GcSection";
import { ComparisonTable } from "./ComparisonTable";
import { LandingFaq } from "./LandingFaq";
import {
  StyledPage,
  StyledHero,
  StyledHeroInner,
  StyledHeroCopy,
  StyledEyebrow,
  StyledHeadline,
  StyledLede,
  StyledBenefitList,
  StyledBenefitItem,
  StyledTextLink,
  StyledFormWrap,
  StyledCtaRow,
  StyledHeroSecondaryCta,
  StyledFootnote,
  StyledHeroFigure,
  StyledHeroImage,
  StyledSection,
  StyledContainer,
  StyledSectionHead,
  StyledSectionTitle,
  StyledSectionLede,
  StyledCardGrid,
  StyledCard,
  StyledCardIcon,
  StyledCardTitle,
  StyledCardText,
  StyledCtaInner,
  StyledCtaMedia,
  StyledMediaImg,
  StyledReassureList,
  StyledReassureItem,
} from "./Landing.styles";
import { Footer } from "../../ui_comps/footer";

interface InfoCard {
  icon: IconType;
  title: string;
  body: string;
}

const PROBLEM_CARDS: InfoCard[] = [
  {
    icon: HiExclamationTriangle,
    title: "Paper doesn't survive the field",
    body: "Sign-in sheets get rained on, buried in a truck, or come back with a column of signatures nobody can read at audit time.",
  },
  {
    icon: HiMagnifyingGlass,
    title: "GCs chase every trade",
    body: "Safety directors drive site to site collecting talk sheets from each subcontractor, often weeks after the meeting happened.",
  },
  {
    icon: HiClock,
    title: "No proof until it's too late",
    body: "There's no way to see a talk was skipped until an OSHA inspection — or an incident — puts it on the record.",
  },
  {
    icon: HiSun,
    title: "Built for the desk, not the site",
    body: "Clipboards and pens lose to bright sun, concrete dust and gloved hands every single morning.",
  },
];

const HERO_BENEFITS: { icon: IconType; label: string }[] = [
  { icon: HiLink, label: "No app to install" },
  { icon: HiSignalSlash, label: "Works with no signal" },
  { icon: HiDocumentCheck, label: "Signed PDF to your GC" },
];

const REASSURANCES = [
  "No credit card, no app to install.",
  "Crews start free — keep your signed PDFs.",
  "Start free, upgrade anytime.",
];

export const Landing = () => {
  return (
    <StyledPage>
      <StyledHero aria-labelledby="landing-hero-heading">
        <StyledHeroInner>
          <StyledHeroFigure>
            <StyledHeroImage
              src="/images/Tailgate_img.jpg"
              alt="A construction foreman leading a tailgate safety talk with his crew on a job site"
              loading="eager"
            />
          </StyledHeroFigure>
          <StyledHeroCopy>
            <StyledEyebrow>Digital Toolbox Safety Talks</StyledEyebrow>
            <StyledHeadline id="landing-hero-heading">
              Run your toolbox talk on your phone.{" "}
              <span>Give the GC proof in seconds.</span>
            </StyledHeadline>
            <StyledLede>
              OSHA expects a toolbox talk before every shift. Skip the lost
              sign-in sheets: the crew signs on-screen and your general
              contractor (GC) gets a signed, timestamped record the moment you
              hit send.
            </StyledLede>
            <StyledBenefitList>
              {HERO_BENEFITS.map(({ icon: Icon, label }) => (
                <StyledBenefitItem key={label}>
                  <Icon aria-hidden="true" />
                  <span>{label}</span>
                </StyledBenefitItem>
              ))}
            </StyledBenefitList>
            <StyledFormWrap>
              <StyledCtaRow>
                <ButtonLink to="/signup" size="lg">
                  I'm a foreman — start free
                </ButtonLink>
                <StyledHeroSecondaryCta
                  href="#for-gcs"
                  size="lg"
                  variant="outline"
                >
                  I'm a GC — see the dashboard
                </StyledHeroSecondaryCta>
              </StyledCtaRow>
              <StyledFootnote>
                Free plans need no credit card.{" "}
                <StyledTextLink as={Link} to="/pricing">
                  See pricing
                </StyledTextLink>
              </StyledFootnote>
            </StyledFormWrap>
          </StyledHeroCopy>
        </StyledHeroInner>
      </StyledHero>

      <StyledSection $tone="light" aria-labelledby="problem-heading">
        <StyledContainer>
          <StyledSectionHead>
            <StyledSectionTitle id="problem-heading">
              The paper safety log is a liability
            </StyledSectionTitle>
            <StyledSectionLede>
              Every crew runs the talk. Almost nobody can prove it cleanly.
            </StyledSectionLede>
          </StyledSectionHead>
          <StyledCardGrid>
            {PROBLEM_CARDS.map(({ icon: Icon, title, body }) => (
              <StyledCard key={title}>
                <StyledCardIcon>
                  <Icon aria-hidden="true" />
                </StyledCardIcon>
                <StyledCardTitle>{title}</StyledCardTitle>
                <StyledCardText>{body}</StyledCardText>
              </StyledCard>
            ))}
          </StyledCardGrid>
        </StyledContainer>
      </StyledSection>

      <HowItWorks />

      <ProductShowcase />

      <GcSection />

      <ComparisonTable />

      <PricingTeaser />

      <LandingFaq />

      <StyledSection $tone="dark" aria-labelledby="cta-heading">
        <StyledCtaInner>
          <StyledCtaMedia>
            <StyledMediaImg
              src="/images/crew-morning-huddle.jpg"
              alt="A crew of construction workers in hard hats gathered together for a morning safety briefing"
              loading="lazy"
              decoding="async"
              width={2400}
              height={1029}
              $ratio="21 / 9"
            />
          </StyledCtaMedia>
          <StyledSectionTitle id="cta-heading">
            Be ready on day one
          </StyledSectionTitle>
          <StyledSectionLede>
            Create your free account and run your first talk today — on the
            right plan for your crew or your jobsites.
          </StyledSectionLede>
          <StyledCtaRow>
            <ButtonLink to="/signup" size="lg">
              Get started free
            </ButtonLink>
          </StyledCtaRow>
          <StyledReassureList>
            {REASSURANCES.map((item) => (
              <StyledReassureItem key={item}>
                <HiCheck aria-hidden="true" />
                <span>{item}</span>
              </StyledReassureItem>
            ))}
          </StyledReassureList>
        </StyledCtaInner>
      </StyledSection>

      <Footer />
    </StyledPage>
  );
};
