import type { Jobsite } from "../../interfaces/jobsite";
import { JobsiteCard } from "./JobsiteCard";
import { StyledEmpty, StyledList } from "./styles";

interface JobsiteListProps {
  jobsites: Jobsite[];
  /** Present ⇒ each card gets an Edit button (admin/safety_manager only). */
  onEdit?: (jobsite: Jobsite) => void;
  onManageSubs: (jobsite: Jobsite) => void;
  /** Present ⇒ each card gets a Team button (GC Portfolio manager only —
   *  Phase 9d-2, assigns superintendents to this job site). */
  onManageMembers?: (jobsite: Jobsite) => void;
  /** Present ⇒ a Site Pro jobsite gets an Integrations button (Phase 9f;
   *  manager only, Procore / ACC document push). */
  onManageIntegrations?: (jobsite: Jobsite) => void;
  /** Present ⇒ an active, non-Site-Pro jobsite shows "Upgrade to Site Pro"
   *  (Phase 12h; manager only, since the server 403s anyone else) instead of
   *  the disabled Defense Bundle button. */
  onUpgrade?: (jobsite: Jobsite) => void;
  /** Always provided — visibility isn't gated per-caller like `onManageMembers`,
   *  since the Defense Bundle (Phase 9e) is gated per-jobsite (`jobsite.sitePro`),
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

/** Presentational list of a GC's jobsites. The manager owns data and modal
 *  state; this only renders and reports clicks. */
export const JobsiteList = ({
  jobsites,
  onEdit,
  onManageSubs,
  onManageMembers,
  onManageIntegrations,
  onUpgrade,
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
        <JobsiteCard
          key={jobsite.id}
          jobsite={jobsite}
          onEdit={onEdit}
          onManageSubs={onManageSubs}
          onManageMembers={onManageMembers}
          onManageIntegrations={onManageIntegrations}
          onUpgrade={onUpgrade}
          onDownloadBundle={onDownloadBundle}
          isDownloadingBundle={isDownloadingBundle}
          isOnline={isOnline}
        />
      ))}
    </StyledList>
  );
};
