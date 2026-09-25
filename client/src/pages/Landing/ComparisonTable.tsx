import { HiCheck, HiXMark } from "react-icons/hi2";

import {
  StyledSection,
  StyledContainer,
  StyledSectionHead,
  StyledSectionTitle,
  StyledSectionLede,
} from "./Landing.styles";
import {
  StyledCompareWrap,
  StyledCompareCaption,
  StyledCompareTable,
  StyledCompareHeadCell,
  StyledCompareRow,
  StyledCompareFeature,
  StyledCompareCell,
  StyledCompareIcon,
} from "./ComparisonTable.styles";

interface CompareRow {
  label: string;
  us: string;
  them: string;
}

const COMPARE_ROWS: CompareRow[] = [
  {
    label: "Getting started",
    us: "Open a link — nothing to install",
    them: "Native App Store download on every phone",
  },
  {
    label: "Effort per talk",
    us: "One short routine, the same every shift",
    them: "2–5 minutes across multi-tier forms",
  },
  {
    label: "Works offline",
    us: "Offline-first PWA; auto-syncs on signal",
    them: "Most need native installs; web tools fail offline",
  },
  {
    label: "Topic library",
    us: "OSHA talk library plus your own custom talks",
    them: "300–600 static topics or manual upload",
  },
  {
    label: "Compliance PDF",
    us: "Signed, timestamped PDF locked once the talk is completed",
    them: "Basic PDF with a timestamp and signature",
  },
  {
    label: "Audit export",
    us: "1-click OSHA Defense Bundle (indexed ZIP) — coming soon",
    them: "Manual cloud search, file by file",
  },
  {
    label: "Pricing",
    us: "Flat rate per site or portfolio",
    them: "Per-user seat fees (~$10–$50/user/mo)",
  },
  {
    label: "Rollout",
    us: "Open a link and start — no rollout",
    them: "1–4 weeks for enterprise rollout",
  },
  {
    label: "Languages",
    us: "Translate custom talks; read aloud in your device's languages",
    them: "Static English/Spanish text",
  },
];

export const ComparisonTable = () => (
  <StyledSection $tone="light" aria-labelledby="compare-heading">
    <StyledContainer>
      <StyledSectionHead>
        <StyledSectionTitle id="compare-heading">
          Built for the field, not the office
        </StyledSectionTitle>
        <StyledSectionLede>
          How the toolbox-talk PWA compares to the native safety apps crews
          already avoid.
        </StyledSectionLede>
      </StyledSectionHead>

      <StyledCompareWrap>
        <StyledCompareTable>
          <StyledCompareCaption>
            Feature comparison of TailgatePro versus legacy construction safety
            apps
          </StyledCompareCaption>
          <thead>
            <tr>
              <StyledCompareHeadCell scope="col">Feature</StyledCompareHeadCell>
              <StyledCompareHeadCell scope="col" $highlight>
                TailgatePro
              </StyledCompareHeadCell>
              <StyledCompareHeadCell scope="col">
                Legacy safety apps
              </StyledCompareHeadCell>
            </tr>
          </thead>
          <tbody>
            {COMPARE_ROWS.map((row) => (
              <StyledCompareRow key={row.label}>
                <StyledCompareFeature scope="row">
                  {row.label}
                </StyledCompareFeature>
                <StyledCompareCell $highlight>
                  <span>
                    <StyledCompareIcon $highlight>
                      <HiCheck aria-hidden="true" />
                    </StyledCompareIcon>
                    {row.us}
                  </span>
                </StyledCompareCell>
                <StyledCompareCell>
                  <span>
                    <StyledCompareIcon>
                      <HiXMark aria-hidden="true" />
                    </StyledCompareIcon>
                    {row.them}
                  </span>
                </StyledCompareCell>
              </StyledCompareRow>
            ))}
          </tbody>
        </StyledCompareTable>
      </StyledCompareWrap>
    </StyledContainer>
  </StyledSection>
);
