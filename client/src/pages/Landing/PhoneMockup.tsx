import type { ReactNode } from "react";
import { HiCheck, HiCheckCircle } from "react-icons/hi2";

import {
  StyledPhoneFrame,
  StyledPhoneScreen,
  StyledStatusBar,
  StyledScreenHeader,
  StyledTopicRow,
  StyledSignRow,
  StyledSubmitted,
  StyledSubmittedTitle,
  StyledSubmittedMeta,
} from "./PhoneMockup.styles";

type PhoneScreen = "topics" | "signature" | "submitted";

interface PhoneMockupProps {
  /** Full-sentence description of the screen for assistive tech. */
  label: string;
  /** Which sample screen to draw. */
  screen: PhoneScreen;
  /** Frame colour for the section it sits on. */
  tone?: "light" | "dark";
}

const TOPICS = [
  "Fall Protection",
  "Ladder Safety",
  "Silica Dust",
  "Heat Illness",
] as const;

const SIGNERS = ["M. Rivera", "D. Okafor", "J. Chen"] as const;

/** A hand-drawn-looking signature stroke. */
const Squiggle = () => (
  <svg
    width="72"
    height="16"
    viewBox="0 0 72 16"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M2 11 q6 -12 12 0 t12 0 q5 -10 10 -2 t12 2 q6 -8 12 -1"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

const SCREENS: Record<PhoneScreen, ReactNode> = {
  topics: (
    <>
      <StyledScreenHeader>Today&apos;s talk</StyledScreenHeader>
      {TOPICS.map((topic, i) => (
        <StyledTopicRow key={topic} $selected={i === 0}>
          <span>{topic}</span>
          {i === 0 && <HiCheck aria-hidden="true" />}
        </StyledTopicRow>
      ))}
    </>
  ),
  signature: (
    <>
      <StyledScreenHeader>Crew sign-off</StyledScreenHeader>
      {SIGNERS.map((name) => (
        <StyledSignRow key={name}>
          <span>{name}</span>
          <Squiggle />
        </StyledSignRow>
      ))}
      <StyledSignRow>
        <span>&nbsp;</span>
      </StyledSignRow>
    </>
  ),
  submitted: (
    <StyledSubmitted>
      <HiCheckCircle aria-hidden="true" />
      <StyledSubmittedTitle>Talk submitted</StyledSubmittedTitle>
      <StyledSubmittedMeta>PDF sent to GC · synced 6:58 AM</StyledSubmittedMeta>
    </StyledSubmitted>
  ),
};

export const PhoneMockup = ({
  label,
  screen,
  tone = "light",
}: PhoneMockupProps) => (
  <StyledPhoneFrame $tone={tone} role="img" aria-label={label}>
    <StyledPhoneScreen aria-hidden="true">
      <StyledStatusBar>
        <span>6:58</span>
        <span>▮▮▮</span>
      </StyledStatusBar>
      {SCREENS[screen]}
    </StyledPhoneScreen>
  </StyledPhoneFrame>
);
