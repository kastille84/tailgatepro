import {
  NO_INSTALL_ANSWER,
  SPONSORED_ACCESS_ANSWER,
  SPONSORED_ACCESS_QUESTION,
} from "../../data/sharedCopy";
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
    a: NO_INSTALL_ANSWER,
  },
  {
    q: "Does it work with no signal?",
    a: "Yes. The entire talk runs offline. Signatures, photos and attendance send automatically once the phone is back on data.",
  },
  {
    q: "What does it cost the subcontractor?",
    a: "Crews start free — the core OSHA talk library, offline talks, digital signatures and auto-emailed PDF exports. Paid plans add custom branding and multi-language talks, and the 5-year legal archive.",
  },
  {
    q: SPONSORED_ACCESS_QUESTION,
    a: SPONSORED_ACCESS_ANSWER,
  },
  {
    q: "When can I sign up?",
    a: "Right now. Create a free account in a minute — no credit card — and upgrade from the pricing page when you need more foremen, branding or a longer archive.",
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
