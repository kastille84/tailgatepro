import type { GcSubScorecardSummary } from "../../interfaces/gcSubcontractors";
import { SubScorecardRow } from "./SubScorecardRow";
import { StyledEmpty, StyledScorecardList } from "./styles";

interface SubScorecardListProps {
  scorecards: GcSubScorecardSummary[];
}

/** Every distinct sub across the GC's portfolio jobsites, worst score first
 *  (the server already sorts it that way). */
export const SubScorecardList = ({ scorecards }: SubScorecardListProps) => {
  if (scorecards.length === 0) {
    return <StyledEmpty>No subcontractors on your portfolio yet.</StyledEmpty>;
  }

  return (
    <StyledScorecardList>
      {scorecards.map((scorecard) => (
        <SubScorecardRow key={scorecard.companyId} scorecard={scorecard} />
      ))}
    </StyledScorecardList>
  );
};
