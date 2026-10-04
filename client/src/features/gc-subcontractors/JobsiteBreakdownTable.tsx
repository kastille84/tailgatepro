import type { GcSubJobsiteBreakdown } from "../../interfaces/gcSubcontractors";
import { ScoreBadge } from "./ScoreBadge";
import {
  StyledBreakdownList,
  StyledBreakdownRow,
  StyledJobsiteDays,
  StyledJobsiteMeta,
  StyledJobsiteName,
} from "./styles";

interface JobsiteBreakdownTableProps {
  jobsites: GcSubJobsiteBreakdown[];
}

/** A card list (not an HTML `<table>` -- no table primitive exists in this
 *  codebase) of a sub's per-jobsite contribution to its overall score. */
export const JobsiteBreakdownTable = ({ jobsites }: JobsiteBreakdownTableProps) => (
  <StyledBreakdownList>
    {jobsites.map((jobsite) => (
      <StyledBreakdownRow key={jobsite.jobsiteId}>
        <StyledJobsiteMeta>
          <StyledJobsiteName>{jobsite.jobsiteName}</StyledJobsiteName>
          <StyledJobsiteDays>
            Logged {jobsite.loggedPeriods} of {jobsite.expectedPeriods} expected{" "}
            {jobsite.cadence === "weekly" ? "weeks" : "days"}
          </StyledJobsiteDays>
        </StyledJobsiteMeta>
        <ScoreBadge score={jobsite.score} />
      </StyledBreakdownRow>
    ))}
  </StyledBreakdownList>
);
