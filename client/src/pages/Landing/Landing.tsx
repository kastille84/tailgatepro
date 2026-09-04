import {
  HiExclamationTriangle,
  HiMagnifyingGlass,
  HiClock,
  HiSun,
  HiQrCode,
  HiSignalSlash,
  HiBolt,
  HiChartBar,
  HiCheck,
} from "react-icons/hi2";
import type { IconType } from "react-icons";

import { WaitlistForm } from "./WaitlistForm";
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
  StyledFormWrap,
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
  StyledFooter,
  StyledFooterMark,
  StyledFooterText,
} from "./Landing.styles";

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

const SOLUTION_CARDS: InfoCard[] = [
  {
    icon: HiQrCode,
    title: "Zero app-store friction",
    body: "Open the talk from a browser link or QR code. Nothing to install, even five floors underground or on a remote site.",
  },
  {
    icon: HiSignalSlash,
    title: "Works offline, always",
    body: "Run the whole talk with no signal. Attendance, signatures and photos sync automatically once the phone is back on data.",
  },
  {
    icon: HiBolt,
    title: "Fast to run, every shift",
    body: "Pick a topic, the crew signs on-screen or you snap a photo, you submit. A timestamp and GPS location lock to the record so it can't be back-dated or redone later.",
  },
  {
    icon: HiChartBar,
    title: "Instant compliance for the GC",
    body: "Every completed talk lands on the general contractor's dashboard the moment the meeting ends — as a tamper-evident, GPS-verified PDF.",
  },
];

const REASSURANCES = [
  "No credit card, no app to install.",
  "Crews start free — keep your emailed PDFs forever.",
  "One email when we launch. No spam.",
];

export const Landing = () => {
  const year = new Date().getFullYear();

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
              The toolbox talk, done before the crew gears up.{" "}
              <span>Proof that holds up in an audit.</span>
            </StyledHeadline>
            <StyledLede>
              OSHA expects a toolbox talk before every shift. On paper that means
              lost sign-in sheets, illegible signatures, and GCs chasing proof
              across every trade. Run the talk on any phone — no app to install,
              no signal required — and a tamper-evident record reaches the GC the
              moment you hit send.
            </StyledLede>
            <StyledFormWrap>
              <WaitlistForm idPrefix="hero" tone="onDark" />
              <StyledFootnote>
                Join the launch waitlist. No spam — one email when we go live.
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

      <StyledSection $tone="light" aria-labelledby="solution-heading">
        <StyledContainer>
          <StyledSectionHead>
            <StyledSectionTitle id="solution-heading">
              Why crews are going digital
            </StyledSectionTitle>
            <StyledSectionLede>
              Same five-minute talk. A compliance record the GC can see
              immediately.
            </StyledSectionLede>
          </StyledSectionHead>
          <StyledCardGrid>
            {SOLUTION_CARDS.map(({ icon: Icon, title, body }) => (
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
            We're onboarding subcontractors and general contractors for launch.
            Add your name and we'll set you up on the right plan the day we go
            live.
          </StyledSectionLede>
          <WaitlistForm idPrefix="cta" tone="onDark" />
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

      <StyledFooter>
        <StyledFooterMark>
          TAILGATE<span>PRO</span>
        </StyledFooterMark>
        <StyledFooterText>
          Digital Toolbox Safety Talks · © {year} TailgatePro
        </StyledFooterText>
      </StyledFooter>
    </StyledPage>
  );
};
