import type { GcJobsite, GcSubCompliance } from "../../interfaces/gcDashboard";
import { SubComplianceRow } from "./SubComplianceRow";
import {
  StyledEmpty,
  StyledJobsiteHeading,
  StyledJobsiteLabel,
  StyledJobsiteSection,
  StyledSubList,
} from "./styles";

interface JobsiteListProps {
  jobsites: GcJobsite[];
  onSelectSub: (sub: GcSubCompliance) => void;
}

/** The GC's linked jobsites, each with its subs' compliance status for the
 *  requested day. */
export const JobsiteList = ({ jobsites, onSelectSub }: JobsiteListProps) => {
  if (jobsites.length === 0) {
    return (
      <StyledEmpty>
        No linked job sites yet. Share your join code with a subcontractor to
        get started.
      </StyledEmpty>
    );
  }

  return (
    <>
      {jobsites.map((jobsite) => (
        <StyledJobsiteSection key={jobsite.name}>
          <StyledJobsiteLabel>Project</StyledJobsiteLabel>
          <StyledJobsiteHeading>{jobsite.name}</StyledJobsiteHeading>
          <StyledSubList>
            {jobsite.subs.map((sub) => (
              <SubComplianceRow
                key={sub.companyId}
                sub={sub}
                onSelect={onSelectSub}
              />
            ))}
          </StyledSubList>
        </StyledJobsiteSection>
      ))}
    </>
  );
};
