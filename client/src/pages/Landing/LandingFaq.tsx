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
    a: "No. Foremen scan a QR code or tap a link to open it straight away in their mobile browser — nothing to install.",
  },
  {
    q: "Does it work with no signal?",
    a: "Yes. The entire talk runs offline. Signatures, photos and attendance sync automatically once the phone is back on data.",
  },
  {
    q: "What does it cost the subcontractor?",
    a: "Crews start free — 30 core OSHA templates, offline talks, digital signatures and auto-emailed PDF exports. Paid plans add the 5-year legal archive, custom branding and AI multi-language audio.",
  },
  {
    q: "How does a GC sponsor subcontractors for free?",
    a: "On a paid GC site or portfolio plan you get project-specific QR codes and links. Any trade on that site scans one to log talks under your dashboard at $0 to them.",
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
