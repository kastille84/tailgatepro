import {
  StyledSection,
  StyledContainer,
  StyledSectionHead,
  StyledSectionTitle,
} from "./Landing.styles";
import {
  StyledFaq,
  StyledFaqItem,
  StyledFaqQuestion,
  StyledFaqAnswer,
} from "./LandingFaq.styles";

interface FaqEntry {
  q: string;
  a: string;
}

const FAQ: FaqEntry[] = [
  {
    q: "Do my sub-foremen need to download an app?",
    a: "No. Foremen tap a link to open it straight away in their mobile browser — nothing to install.",
  },
  {
    q: "Does it work with no signal?",
    a: "Yes. The entire talk runs offline. Signatures, photos and attendance sync automatically once the phone is back on data.",
  },
  {
    q: "What does it cost the subcontractor?",
    a: "Crews start free — the core OSHA talk library, offline talks, digital signatures and auto-emailed PDF exports. Paid plans add custom branding and multi-language talks, and the 5-year legal archive.",
  },
  {
    q: "How does a GC sponsor subcontractors for free?",
    a: "A GC invites subcontractors to a jobsite by email or shares a company join code, and their talks land on the GC's dashboard with no seat fee for the subs. Full sponsored access on paid GC plans is coming soon.",
  },
  {
    q: "When can I actually sign up?",
    a: "We're onboarding subcontractors and general contractors for launch now. Join the waitlist and we'll set you up on the right plan the moment we go live.",
  },
];

export const LandingFaq = () => (
  <StyledSection $tone="light" aria-labelledby="faq-heading">
    <StyledContainer>
      <StyledSectionHead>
        <StyledSectionTitle id="faq-heading">
          Questions crews and GCs ask us
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
);
