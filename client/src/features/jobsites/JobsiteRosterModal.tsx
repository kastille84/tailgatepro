import { useState } from "react";

import { Button } from "../../ui_comps/button";
import { ConfirmDialog } from "../../ui_comps/confirm-dialog";
import { Modal } from "../../ui_comps/modal";
import { useOnlineStatus } from "../../context/online-status";
import { useRemoveSubcontractor } from "../../hooks/useRemoveSubcontractor";
import type { Jobsite, JobsiteSubcontractor } from "../../interfaces/jobsite";
import { InviteSubcontractorForm } from "./InviteSubcontractorForm";
import {
  StyledMeta,
  StyledName,
  StyledNote,
  StyledRosterList,
  StyledRosterMain,
  StyledRosterRow,
  StyledRosterSection,
  StyledRosterStatus,
} from "./styles";

interface JobsiteRosterModalProps {
  jobsite: Jobsite;
  /** Hides invite/remove controls for a GC role the server would 403 anyway. */
  canManage: boolean;
  onClose: () => void;
}

/** A jobsite's roster: who's invited (pending) and who's on the site
 *  (accepted), plus invite and remove for admin/safety_manager. The roster
 *  comes from the live jobsite list, so it refreshes after each mutation. */
export const JobsiteRosterModal = ({
  jobsite,
  canManage,
  onClose,
}: JobsiteRosterModalProps) => {
  const { isOnline } = useOnlineStatus();
  const { removeSubcontractor, isRemoving } = useRemoveSubcontractor();
  const [removing, setRemoving] = useState<JobsiteSubcontractor | undefined>(
    undefined,
  );

  const isRemovingAccepted = removing?.status === "accepted";

  // Only reachable from the confirm dialog, which opens with `removing` set.
  const handleRemove = async () => {
    try {
      await removeSubcontractor({ jobsiteId: jobsite.id, subId: removing!.id });
    } catch {
      // useRemoveSubcontractor surfaces the failure as a toast.
    }
    setRemoving(undefined);
  };

  return (
    <Modal isOpen onClose={onClose} title={`${jobsite.name} — subcontractors`}>
      <StyledRosterSection>
        {canManage && (
          <>
            <StyledNote>
              Invite a subcontractor by email. They'll get a link to join this
              job site with their company.
            </StyledNote>
            {!isOnline && (
              <StyledNote role="status">
                You're offline. Connect to the internet to send an invite.
              </StyledNote>
            )}
            <InviteSubcontractorForm jobsiteId={jobsite.id} />
          </>
        )}

        {jobsite.subcontractors.length === 0 ? (
          <StyledNote>No subcontractors invited yet.</StyledNote>
        ) : (
          <StyledRosterList>
            {jobsite.subcontractors.map((sub) => {
              const isAccepted = sub.status === "accepted";
              return (
                <StyledRosterRow key={sub.id}>
                  <StyledRosterMain>
                    <StyledName>{sub.companyName ?? sub.email}</StyledName>
                    {sub.companyName && <StyledMeta>{sub.email}</StyledMeta>}
                  </StyledRosterMain>
                  <StyledRosterStatus $accepted={isAccepted}>
                    {isAccepted ? "Accepted" : "Pending"}
                  </StyledRosterStatus>
                  {canManage && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!isOnline}
                      onClick={() => setRemoving(sub)}
                      aria-label={`${isAccepted ? "Remove" : "Cancel invite for"} ${sub.email}`}
                    >
                      {isAccepted ? "Remove" : "Cancel invite"}
                    </Button>
                  )}
                </StyledRosterRow>
              );
            })}
          </StyledRosterList>
        )}
      </StyledRosterSection>

      <ConfirmDialog
        isOpen={Boolean(removing)}
        title={isRemovingAccepted ? "Remove subcontractor" : "Cancel invite"}
        confirmLabel={isRemovingAccepted ? "Remove" : "Cancel invite"}
        confirmVariant="danger"
        isBusy={isRemoving}
        onConfirm={handleRemove}
        onClose={() => setRemoving(undefined)}
      >
        {removing &&
          (isRemovingAccepted ? (
            <>
              Remove <strong>{removing.companyName ?? removing.email}</strong>{" "}
              from {jobsite.name}? You'll lose dashboard access to that
              subcontractor's project history here. PDFs you've already
              received aren't affected.
            </>
          ) : (
            <>
              Cancel the invite sent to <strong>{removing.email}</strong>? The
              link in their email will stop working.
            </>
          ))}
      </ConfirmDialog>
    </Modal>
  );
};
