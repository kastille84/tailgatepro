import type { GcSubScorecardSummary } from "../../interfaces/gcSubcontractors";
import { ScoreBadge } from "./ScoreBadge";
import { StyledCompanyName, StyledScorecardRow } from "./styles";

interface SubScorecardRowProps {
  scorecard: GcSubScorecardSummary;
}

/** One subcontractor's rolling 30-day score, linking to its per-jobsite
 *  breakdown. Unlike gc-dashboard's SubComplianceRow, there's no locked-sub
 *  branch here -- this whole feature is gated to GC Portfolio, which already
 *  has every sub unlocked (`unlockedSubs: null`). */
export const SubScorecardRow = ({ scorecard }: SubScorecardRowProps) => (
  <li>
    <StyledScorecardRow to={`/gc/subcontractors/${scorecard.companyId}`}>
      <StyledCompanyName>{scorecard.companyName ?? "Unknown company"}</StyledCompanyName>
      <ScoreBadge score={scorecard.overallScore} />
    </StyledScorecardRow>
  </li>
);
