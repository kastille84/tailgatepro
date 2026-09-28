import type { PolicyPushJobsite } from "../../interfaces/policyPush";
import {
  StyledEmpty,
  StyledJobsiteBlock,
  StyledJobsiteName,
  StyledStatusPill,
  StyledSubList,
  StyledSubName,
  StyledSubRow,
} from "./styles";

interface PolicyComplianceTableProps {
  jobsites: PolicyPushJobsite[];
}

/** A card list (not an HTML `<table>` -- no table primitive exists in this
 *  codebase) of every active jobsite's roster and whether each sub has
 *  logged the currently pushed topic yet. Only rendered while a push is
 *  active -- see `GcPolicyPush.tsx`. */
export const PolicyComplianceTable = ({ jobsites }: PolicyComplianceTableProps) => {
  if (jobsites.length === 0) {
    return <StyledEmpty>No active job sites with an accepted subcontractor yet.</StyledEmpty>;
  }

  return (
    <>
      {jobsites.map((jobsite) => (
        <StyledJobsiteBlock key={jobsite.id}>
          <StyledJobsiteName>{jobsite.name}</StyledJobsiteName>
          <StyledSubList>
            {jobsite.subs.map((sub) => (
              <StyledSubRow key={sub.companyId}>
                <StyledSubName>{sub.companyName ?? "Unknown company"}</StyledSubName>
                <StyledStatusPill $status={sub.status}>
                  {sub.status === "logged" ? "Logged" : "Missing"}
                </StyledStatusPill>
              </StyledSubRow>
            ))}
          </StyledSubList>
        </StyledJobsiteBlock>
      ))}
    </>
  );
};
