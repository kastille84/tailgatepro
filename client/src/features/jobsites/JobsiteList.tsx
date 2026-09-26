import { Button } from "../../ui_comps/button";
import type { Jobsite } from "../../interfaces/jobsite";
import {
  StyledArchivedBadge,
  StyledCard,
  StyledCardActions,
  StyledCardMain,
  StyledEmpty,
  StyledList,
  StyledMeta,
  StyledName,
  StyledOriginBadge,
  StyledStatusBadge,
} from "./styles";

interface JobsiteListProps {
  jobsites: Jobsite[];
  /** Present ⇒ each card gets an Edit button (admin/safety_manager only). */
  onEdit?: (jobsite: Jobsite) => void;
  onManageSubs: (jobsite: Jobsite) => void;
}

const describeRoster = (jobsite: Jobsite) => {
  const accepted = jobsite.subcontractors.filter(
    (sub) => sub.status === "accepted",
  ).length;
  const pending = jobsite.subcontractors.length - accepted;
  return `${accepted} subcontractor${accepted === 1 ? "" : "s"}, ${pending} pending`;
};

/** Presentational list of a GC's jobsites. The manager owns data and modal
 *  state; this only renders and reports clicks. */
export const JobsiteList = ({
  jobsites,
  onEdit,
  onManageSubs,
}: JobsiteListProps) => {
  if (jobsites.length === 0) {
    return (
      <StyledEmpty>
        No job sites yet. Create one, then invite your subcontractors to it.
      </StyledEmpty>
    );
  }

  return (
    <StyledList>
      {jobsites.map((jobsite) => (
        <StyledCard key={jobsite.id}>
          <StyledCardMain>
            <StyledName>{jobsite.name}</StyledName>
            <StyledMeta>{describeRoster(jobsite)}</StyledMeta>
            {jobsite.createdBySub && (
              <StyledOriginBadge>Created by subcontractor</StyledOriginBadge>
            )}
          </StyledCardMain>
          <StyledCardActions>
            {jobsite.archivedAt ? (
              <StyledArchivedBadge>Archived</StyledArchivedBadge>
            ) : (
              <StyledStatusBadge $status={jobsite.status}>
                {jobsite.status}
              </StyledStatusBadge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onManageSubs(jobsite)}
              aria-label={`Subcontractors for ${jobsite.name}`}
            >
              Subs
            </Button>
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(jobsite)}
                aria-label={`Edit ${jobsite.name}`}
              >
                Edit
              </Button>
            )}
          </StyledCardActions>
        </StyledCard>
      ))}
    </StyledList>
  );
};
