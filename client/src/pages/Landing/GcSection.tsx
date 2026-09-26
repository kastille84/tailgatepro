import { HiCheck } from "react-icons/hi2";

import {
  StyledSection,
  StyledContainer,
  StyledSectionHead,
  StyledSectionTitle,
  StyledSectionLede,
  StyledEyebrow,
  StyledMediaImg,
} from "./Landing.styles";
import { GcDashboardMockup } from "./GcDashboardMockup";
import {
  StyledGcLayout,
  StyledGcMedia,
  StyledGcAside,
  StyledGcList,
  StyledGcItem,
  StyledSoonTag,
  StyledCallout,
  StyledCalloutTitle,
  StyledCalloutText,
} from "./GcSection.styles";

interface GcPoint {
  text: string;
  comingSoon?: boolean;
}

const GC_POINTS: GcPoint[] = [
  { text: "Flat rate per site or portfolio — never per user seat." },
  {
    text: "Invite subcontractors to your jobsite — no seat fees for the subs.",
  },
  { text: "See who has logged a talk today and open each signed PDF." },
  {
    text: "Auto-SMS nudges non-compliant foremen every Monday at 7:00 AM.",
    comingSoon: true,
  },
  {
    text: "1-click OSHA Defense Bundle — an indexed ZIP of every site log.",
    comingSoon: true,
  },
];

export const GcSection = () => (
  <StyledSection $tone="muted" aria-labelledby="gc-heading">
    <StyledContainer>
      <StyledSectionHead>
        <StyledEyebrow>For general contractors</StyledEyebrow>
        <StyledSectionTitle id="gc-heading">
          One dashboard for every trade on the site
        </StyledSectionTitle>
        <StyledSectionLede>
          Stop driving site to site for sign-in sheets. Every subcontractor&apos;s
          talk lands in one compliance view the moment the meeting ends.
        </StyledSectionLede>
      </StyledSectionHead>

      <StyledGcLayout>
        <StyledGcMedia>
          <GcDashboardMockup tone="light" />
          <StyledMediaImg
            src="/images/gc-superintendent-tablet.jpg"
            alt="A construction superintendent in a hard hat and hi-vis vest reviewing site compliance on a tablet"
            loading="lazy"
            decoding="async"
            width={1600}
            height={2000}
            $ratio="4 / 5"
          />
        </StyledGcMedia>

        <StyledGcAside>
          <StyledGcList>
            {GC_POINTS.map(({ text, comingSoon }) => (
              <StyledGcItem key={text}>
                <HiCheck aria-hidden="true" />
                <span>
                  {text}
                  {comingSoon && <StyledSoonTag>Coming soon</StyledSoonTag>}
                </span>
              </StyledGcItem>
            ))}
          </StyledGcList>

          <StyledCallout>
            <StyledCalloutTitle>Zero subcontractor seat tax</StyledCalloutTitle>
            <StyledCalloutText>
              Legacy platforms charge per user seat, penalizing you for adding
              trade subcontractors to your project. With <strong>GC Site Pro</strong>{" "}
              or <strong>GC Portfolio</strong> you pay a flat rate per site or
              portfolio, and{" "}
              <strong>subcontractors on your job never pay a seat fee</strong>{" "}
              — no app-store downloads and no user-billing disputes.
            </StyledCalloutText>
          </StyledCallout>
        </StyledGcAside>
      </StyledGcLayout>
    </StyledContainer>
  </StyledSection>
);
