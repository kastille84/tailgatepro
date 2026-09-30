import { useState } from "react";

import { Button } from "../../ui_comps/button";
import { Checkbox } from "../../ui_comps/checkbox";
import { ProgressModal } from "../../ui_comps/progress-modal";
import { Spinner } from "../../ui_comps/spinner";
import { UpgradeModal } from "../../ui_comps/upgrade-modal";
import { useUpgradeModal } from "../../hooks/useUpgradeModal";
import { useOnlineStatus } from "../../context/online-status";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { useDownloadDefenseBundle } from "../../hooks/useDownloadDefenseBundle";
import { useJobsites } from "../../hooks/useJobsites";
import { useSiteCheckoutReturn } from "../../hooks/useSiteCheckoutReturn";
import type { Jobsite } from "../../interfaces/jobsite";
import { JobsiteForm } from "./JobsiteForm";
import { JobsiteList } from "./JobsiteList";
import { JobsiteMembersModal } from "./JobsiteMembersModal";
import { JobsiteRosterModal } from "./JobsiteRosterModal";
import { SiteProCheckoutModal } from "./SiteProCheckoutModal";
import { StyledNote, StyledToolbar } from "./styles";

/** Server-enforced (`requireRole(...MANAGER_ROLES)`); mirrored here only to
 *  hide controls a GC foreman would get a 403 from. */
const MANAGER_ROLES = ["admin", "safety_manager"];

/** The GC's job-site surface on the Projects page: list, create/edit, and the
 *  per-jobsite subcontractor roster. Online-only (docs/jobsite-design.md). */
export const JobsiteManager = () => {
  const { isOnline } = useOnlineStatus();
  const { role, plan } = useCurrentUser();
  const canManage = role !== null && MANAGER_ROLES.includes(role);
  // Superintendent roles/scoping are GC Portfolio only (Phase 9d-2).
  const canManageMembers = canManage && plan === "gc-portfolio";

  const { downloadBundle, isPending: isDownloadingBundle } = useDownloadDefenseBundle();
  const upgrade = useUpgradeModal();
  useSiteCheckoutReturn();

  const [showArchived, setShowArchived] = useState(false);
  const { jobsites, isLoading, isError } = useJobsites();
  const visibleJobsites = showArchived
    ? jobsites
    : jobsites.filter((jobsite) => !jobsite.archivedAt);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<Jobsite | undefined>(undefined);
  // Held by id, not by object, so the roster modal re-renders from the live
  // list after an invite/remove refetch instead of showing a stale snapshot.
  const [rosterId, setRosterId] = useState<string | undefined>(undefined);
  const rosterJobsite = jobsites.find((jobsite) => jobsite.id === rosterId);
  const [membersId, setMembersId] = useState<string | undefined>(undefined);
  const membersJobsite = jobsites.find((jobsite) => jobsite.id === membersId);
  const [siteProId, setSiteProId] = useState<string | undefined>(undefined);
  const siteProJobsite = jobsites.find((jobsite) => jobsite.id === siteProId);

  const openCreate = () => {
    setEditing(undefined);
    setIsFormOpen(true);
  };

  const openEdit = (jobsite: Jobsite) => {
    setEditing(jobsite);
    setIsFormOpen(true);
  };

  return (
    <>
      {!isOnline && (
        <StyledNote role="status">
          You're offline. Reconnect to manage your job sites.
        </StyledNote>
      )}

      <StyledToolbar>
        <Checkbox
          label="Show archived"
          checked={showArchived}
          onChange={(event) => setShowArchived(event.target.checked)}
        />
        {canManage && (
          <Button
            variant="primary"
            size="md"
            disabled={!isOnline}
            onClick={openCreate}
          >
            New job site
          </Button>
        )}
      </StyledToolbar>

      {isLoading && <Spinner center message="Loading job sites…" />}
      {isError && (
        <StyledNote role="alert">
          Could not load your job sites. Refresh to try again.
        </StyledNote>
      )}
      {!isLoading && !isError && (
        <JobsiteList
          jobsites={visibleJobsites}
          onEdit={canManage ? openEdit : undefined}
          onManageSubs={(jobsite) => setRosterId(jobsite.id)}
          onManageMembers={canManageMembers ? (jobsite) => setMembersId(jobsite.id) : undefined}
          onUpgrade={canManage ? (jobsite) => setSiteProId(jobsite.id) : undefined}
          onDownloadBundle={downloadBundle}
          isDownloadingBundle={isDownloadingBundle}
          isOnline={isOnline}
        />
      )}

      <JobsiteForm
        key={editing?.id ?? "new"}
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        jobsite={editing}
        onPlanLimit={() => {
          setIsFormOpen(false);
          upgrade.open("fourth-site");
        }}
      />

      <UpgradeModal trigger={upgrade.trigger} onClose={upgrade.close} />

      <SiteProCheckoutModal
        jobsite={siteProJobsite ?? null}
        isOnline={isOnline}
        onClose={() => setSiteProId(undefined)}
      />

      {rosterJobsite && (
        <JobsiteRosterModal
          jobsite={rosterJobsite}
          canManage={canManage}
          onClose={() => setRosterId(undefined)}
        />
      )}

      {membersJobsite && (
        <JobsiteMembersModal jobsite={membersJobsite} onClose={() => setMembersId(undefined)} />
      )}

      <ProgressModal
        isOpen={isDownloadingBundle}
        title="Preparing your Defense Bundle"
        message="Zipping up this site's meeting logs and PDFs — this can take a minute or two for sites with a lot of history. Please don't close this tab."
      />
    </>
  );
};
