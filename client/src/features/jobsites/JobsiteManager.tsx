import { useState } from "react";

import { Button } from "../../ui_comps/button";
import { Checkbox } from "../../ui_comps/checkbox";
import { Spinner } from "../../ui_comps/spinner";
import { useOnlineStatus } from "../../context/online-status";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { useJobsites } from "../../hooks/useJobsites";
import type { Jobsite } from "../../interfaces/jobsite";
import { JobsiteForm } from "./JobsiteForm";
import { JobsiteList } from "./JobsiteList";
import { JobsiteRosterModal } from "./JobsiteRosterModal";
import { StyledNote, StyledToolbar } from "./styles";

/** Server-enforced (`requireRole(...MANAGER_ROLES)`); mirrored here only to
 *  hide controls a GC foreman would get a 403 from. */
const MANAGER_ROLES = ["admin", "safety_manager"];

/** The GC's job-site surface on the Projects page: list, create/edit, and the
 *  per-jobsite subcontractor roster. Online-only (docs/jobsite-design.md). */
export const JobsiteManager = () => {
  const { isOnline } = useOnlineStatus();
  const { role } = useCurrentUser();
  const canManage = role !== null && MANAGER_ROLES.includes(role);

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
        />
      )}

      <JobsiteForm
        key={editing?.id ?? "new"}
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        jobsite={editing}
      />

      {rosterJobsite && (
        <JobsiteRosterModal
          jobsite={rosterJobsite}
          canManage={canManage}
          onClose={() => setRosterId(undefined)}
        />
      )}
    </>
  );
};
