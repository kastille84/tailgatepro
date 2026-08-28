import {
  HiExclamationTriangle,
  HiMagnifyingGlass,
  HiClock,
  HiSun,
  HiSignalSlash,
  HiShieldCheck,
  HiPencilSquare,
  HiChartBar,
} from "react-icons/hi2";
import type { IconType } from "react-icons";

import { WaitlistForm } from "./WaitlistForm";
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
    body: "Sign-in sheets get rained on, buried in a truck, or filled with signatures nobody can read at audit time.",
  },
  {
    icon: HiMagnifyingGlass,
    title: "GCs chase every trade",
    body: "Safety directors drive site to site collecting talk sheets from each subcontractor, weeks after the meeting.",
  },
  {
    icon: HiClock,
    title: "No proof until it's too late",
    body: "There's no way to see a talk was skipped until an OSHA inspection — or an incident — puts it on the record.",
  },
  {
    icon: HiSun,
    title: "Built for the desk, not the site",
    body: "Clipboards and pens lose to bright sun, concrete dust, and gloved hands every single morning.",
  },
];

const SOLUTION_CARDS: InfoCard[] = [
  {
    icon: HiSignalSlash,
    title: "Works with zero signal",
    body: "Run the entire talk offline. Attendance and signatures sync automatically once the phone is back on data.",
  },
  {
    icon: HiShieldCheck,
    title: "OSHA content, ready to run",
    body: "A library of compliant toolbox talks sourced from OSHA and state agencies, tagged by trade.",
  },
  {
    icon: HiPencilSquare,
    title: "Sign-off in seconds",
    body: "The crew signs on-screen; attendance, a timestamp, and a crew photo attach to the log for you.",
  },
  {
    icon: HiChartBar,
    title: "Instant compliance for the GC",
    body: "Every completed talk lands on the general contractor's dashboard the moment the meeting ends.",
  },
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
              Paperless Safety Talks. <span>Instant Compliance.</span>
            </StyledHeadline>
            <StyledLede>
              OSHA expects a toolbox talk before the shift — every shift. On
              paper that means lost sign-in sheets, illegible signatures, and
              general contractors chasing proof across every trade. Move the
              talk to the phone and the compliance record writes itself.
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

      <StyledSection $tone="muted" aria-labelledby="solution-heading">
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

      <StyledSection $tone="dark" aria-labelledby="cta-heading">
        <StyledCtaInner>
          <StyledSectionTitle id="cta-heading">
            Be ready on day one
          </StyledSectionTitle>
          <StyledSectionLede>
            We're onboarding subcontractors and general contractors for launch.
            Add your name and we'll be in touch.
          </StyledSectionLede>
          <WaitlistForm idPrefix="cta" tone="onDark" />
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
