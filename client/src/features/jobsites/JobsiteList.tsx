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

import { HiOutlineDownload } from "react-icons/hi";

interface JobsiteListProps {
  jobsites: Jobsite[];
  /** Present ⇒ each card gets an Edit button (admin/safety_manager only). */
  onEdit?: (jobsite: Jobsite) => void;
  onManageSubs: (jobsite: Jobsite) => void;
  /** Present ⇒ each card gets a Team button (GC Portfolio manager only —
   *  Phase 9d-2, assigns superintendents to this job site). */
  onManageMembers?: (jobsite: Jobsite) => void;
  /** Always provided — visibility isn't gated per-caller like `onManageMembers`,
   *  since the Defense Bundle (Phase 9e) is gated per-jobsite (`jobsite.plan`),
   *  not per-company-role. A non-Site-Pro jobsite renders an upgrade link
   *  instead of a working button, so the paid feature stays visible. */
  onDownloadBundle: (jobsite: Jobsite) => void;
  /** True while any bundle download is in flight — disables every Defense
   *  Bundle button, same one-at-a-time simplification `useGcMeetingPdfUrl`'s
   *  callers already accept for the single-PDF download. */
  isDownloadingBundle?: boolean;
  /** Disables the Defense Bundle button while offline — a ZIP download is
   *  online-only, same as `SubMeetingsModal`'s single-PDF download button. */
  isOnline: boolean;
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
  onManageMembers,
  onDownloadBundle,
  isDownloadingBundle = false,
  isOnline,
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
            {onManageMembers && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onManageMembers(jobsite)}
                aria-label={`Superintendents for ${jobsite.name}`}
              >
                Team
              </Button>
            )}
            {jobsite.plan === "site_pro" ? (
              <Button
                variant="outline"
                size="sm"
                disabled={!isOnline}
                loading={isDownloadingBundle}
                leftIcon={<HiOutlineDownload />}
                onClick={() => onDownloadBundle(jobsite)}
                aria-label={`Download OSHA Defense Bundle for ${jobsite.name}`}
                title={`Download OSHA Defense Bundle for ${jobsite.name}`}
              >
                Defense Bundle
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<HiOutlineDownload />}
                disabled={true}
                aria-label={`Download OSHA Defense Bundle for ${jobsite.name}`}
              >
                Defense Bundle
              </Button>
            )}
            {onEdit && (
              <Button
                variant="primary"
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
