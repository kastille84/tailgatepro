import { HiQrCode, HiPencilSquare, HiPaperAirplane } from "react-icons/hi2";
import type { IconType } from "react-icons";

import {
  StyledSection,
  StyledContainer,
  StyledSectionHead,
  StyledSectionTitle,
  StyledSectionLede,
  StyledMediaImg,
} from "./Landing.styles";
import {
  StyledStepsMedia,
  StyledSteps,
  StyledStep,
  StyledStepTop,
  StyledStepNumber,
  StyledStepIcon,
  StyledStepTitle,
  StyledStepText,
  StyledStepsFootnote,
} from "./HowItWorks.styles";

interface Step {
  icon: IconType;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    icon: HiQrCode,
    title: "Open with a tap",
    body: "Scan the site QR code or tap a link. The talk opens in your phone's browser — no app store, no login, five floors underground or on a remote site.",
  },
  {
    icon: HiPencilSquare,
    title: "Run the talk",
    body: "Pick today's topic from the OSHA talk library or generate a custom hazard talk. Each worker signs on-screen or you snap one crew photo.",
  },
  {
    icon: HiPaperAirplane,
    title: "Submit",
    body: "Attendance, GPS location and a timestamp lock to a tamper-evident PDF. It emails to the GC and hits their dashboard the moment you tap send.",
  },
];

export const HowItWorks = () => (
  <StyledSection $tone="muted" aria-labelledby="how-heading">
    <StyledContainer>
      <StyledSectionHead>
        <StyledSectionTitle id="how-heading">
          Run the talk without slowing down the morning
        </StyledSectionTitle>
        <StyledSectionLede>
          Pick a topic, capture the crew, submit — the same way on every site,
          every shift. The compliance record writes itself, online or the next
          time you get signal.
        </StyledSectionLede>
      </StyledSectionHead>

      <StyledStepsMedia>
        <StyledMediaImg
          src="/images/overhead-view.jpg"
          alt="An overhead view of a construction site with workers gathered around for a safety briefing"
          loading="lazy"
          decoding="async"
          width={1280}
          height={1887}
          $ratio="4 / 3"
        />
      </StyledStepsMedia>

      <StyledSteps>
        {STEPS.map(({ icon: Icon, title, body }, i) => (
          <StyledStep key={title}>
            <StyledStepTop>
              <StyledStepNumber>{i + 1}</StyledStepNumber>
              <StyledStepIcon>
                <Icon aria-hidden="true" />
              </StyledStepIcon>
            </StyledStepTop>
            <StyledStepTitle>{title}</StyledStepTitle>
            <StyledStepText>{body}</StyledStepText>
          </StyledStep>
        ))}
      </StyledSteps>

      <StyledStepsFootnote>
        The same short routine on every site, every shift — and it all works with
        zero signal, syncing once the phone is back on data.
      </StyledStepsFootnote>
    </StyledContainer>
  </StyledSection>
);
