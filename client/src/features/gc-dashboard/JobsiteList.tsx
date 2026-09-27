import type { GcJobsite, GcSubCompliance } from "../../interfaces/gcDashboard";
import { StyledOriginBadge } from "../projects/styles";
import { SubComplianceRow } from "./SubComplianceRow";
import {
  StyledEmpty,
  StyledJobsiteEmpty,
  StyledJobsiteHeading,
  StyledJobsiteLabel,
  StyledJobsiteLink,
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
        get started, or{" "}
        <StyledJobsiteLink to="/projects">create a job site</StyledJobsiteLink>.
      </StyledEmpty>
    );
  }

  return (
    <>
      {jobsites.map((jobsite) => (
        <StyledJobsiteSection key={jobsite.id}>
          <StyledJobsiteLabel>Project</StyledJobsiteLabel>
          <StyledJobsiteHeading>{jobsite.name}</StyledJobsiteHeading>
          {jobsite.createdBySub && (
            <StyledOriginBadge>Created by subcontractor</StyledOriginBadge>
          )}
          {jobsite.subs.length === 0 ? (
            <>
              <StyledJobsiteEmpty>
                No subcontractors on this job site yet.
              </StyledJobsiteEmpty>
              <StyledJobsiteLink to="/projects">
                Invite subcontractors
              </StyledJobsiteLink>
            </>
          ) : (
            <StyledSubList>
              {jobsite.subs.map((sub, index) => (
                <SubComplianceRow
                  key={sub.companyId ?? `locked-${index}`}
                  sub={sub}
                  onSelect={onSelectSub}
                />
              ))}
            </StyledSubList>
          )}
        </StyledJobsiteSection>
      ))}
    </>
  );
};
