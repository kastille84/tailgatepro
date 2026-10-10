import { useState } from "react";

import { Button } from "../../ui_comps/button";
import { ConfirmDialog } from "../../ui_comps/confirm-dialog";
import { Spinner } from "../../ui_comps/spinner";
import { useInHouseCrewActions, useInHouseCrews } from "../../hooks/useInHouseCrews";
import type { InHouseCrew } from "../../interfaces/inHouseCrew";
import { CrewAccessModal } from "./CrewAccessModal";
import { CrewForm } from "./CrewForm";
import { CrewInviteModal } from "./CrewInviteModal";
import { CrewRenameModal } from "./CrewRenameModal";
import {
  StyledCrewActions,
  StyledCrewList,
  StyledCrewName,
  StyledCrewRow,
  StyledNote,
} from "./styles";

/** Settings → In-house crews (GC managers): list, add, rename, archive/restore,
 *  delete and invite. Deleting is only allowed for a crew with no history; the
 *  server's 409 says so, and archiving is the alternative. */
export const InHouseCrewsSection = () => {
  const { crews, isLoading, isError } = useInHouseCrews();
  const { updateCrew, isUpdating, deleteCrew, isDeleting } = useInHouseCrewActions();
  const [isAdding, setIsAdding] = useState(false);
  const [renaming, setRenaming] = useState<InHouseCrew | undefined>(undefined);
  const [inviting, setInviting] = useState<InHouseCrew | undefined>(undefined);
  const [managingAccess, setManagingAccess] = useState<InHouseCrew | undefined>(undefined);
  const [deleting, setDeleting] = useState<InHouseCrew | undefined>(undefined);

  const toggleArchive = async (crew: InHouseCrew) => {
    try {
      await updateCrew({ id: crew.id, patch: { archived: !crew.archivedAt } });
    } catch {
      // useInHouseCrewActions already surfaces the failure as a toast.
    }
  };

  const confirmDelete = async () => {
    try {
      await deleteCrew(deleting!.id);
    } catch {
      // The failure (e.g. 409 "archive it instead") is shown as a toast.
    }
    setDeleting(undefined);
  };

  return (
    <>
      <StyledNote>
        Your company's own crews (for example framing or roofing). Each goes on the job
        sites you choose and is tracked on your dashboard.
      </StyledNote>

      {isLoading && <Spinner message="Loading crews…" />}
      {isError && (
        <StyledNote role="alert">Could not load your crews. Refresh to try again.</StyledNote>
      )}

      {!isLoading && !isError && crews.length === 0 && (
        <StyledNote>No in-house crews yet.</StyledNote>
      )}

      {crews.length > 0 && (
        <StyledCrewList>
          {crews.map((crew) => (
            <StyledCrewRow key={crew.id}>
              <StyledCrewName $archived={!!crew.archivedAt}>
                {crew.name}
                {crew.archivedAt ? " (archived)" : ""}
              </StyledCrewName>
              <StyledCrewActions>
                {!crew.archivedAt && (
                  <Button type="button" variant="outline" size="md" onClick={() => setInviting(crew)}>
                    Invite someone
                  </Button>
                )}
                <Button type="button" variant="outline" size="md" onClick={() => setManagingAccess(crew)}>
                  People &amp; link
                </Button>
                <Button type="button" variant="outline" size="md" onClick={() => setRenaming(crew)}>
                  Rename
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  loading={isUpdating}
                  onClick={() => toggleArchive(crew)}
                >
                  {crew.archivedAt ? "Restore" : "Archive"}
                </Button>
                <Button type="button" variant="danger" size="md" onClick={() => setDeleting(crew)}>
                  Delete
                </Button>
              </StyledCrewActions>
            </StyledCrewRow>
          ))}
        </StyledCrewList>
      )}

      <div>
        <Button type="button" variant="primary" size="md" onClick={() => setIsAdding(true)}>
          Add in-house crews
        </Button>
      </div>

      <CrewForm isOpen={isAdding} onClose={() => setIsAdding(false)} />
      {renaming && <CrewRenameModal crew={renaming} onClose={() => setRenaming(undefined)} />}
      {inviting && <CrewInviteModal crew={inviting} onClose={() => setInviting(undefined)} />}
      {managingAccess && (
        <CrewAccessModal crew={managingAccess} onClose={() => setManagingAccess(undefined)} />
      )}
      <ConfirmDialog
        isOpen={!!deleting}
        title="Delete this crew?"
        confirmLabel="Delete crew"
        confirmVariant="danger"
        isBusy={isDeleting}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(undefined)}
      >
        {deleting?.name} will be removed from your job sites. A crew with safety talks or
        users can't be deleted — archive it instead.
      </ConfirmDialog>
    </>
  );
};
