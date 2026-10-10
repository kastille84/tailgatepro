import { useState } from "react";

import { Button } from "../../ui_comps/button";
import { ConfirmDialog } from "../../ui_comps/confirm-dialog";
import { Spinner } from "../../ui_comps/spinner";
import { useCrewMembers } from "../../hooks/useCrewMembers";
import type { CrewMember, InHouseCrew } from "../../interfaces/inHouseCrew";
import {
  StyledCrewList,
  StyledCrewRow,
  StyledMemberMeta,
  StyledMemberName,
  StyledNote,
  StyledSection,
  StyledSectionTitle,
} from "./styles";

const ROLE_LABELS: Record<CrewMember["role"], string> = {
  admin: "Admin",
  safety_manager: "Safety Director",
  foreman: "Foreman",
};

interface CrewPeopleSectionProps {
  crew: InHouseCrew;
}

/** Who has joined a crew, with a Remove for each person (Phase 13f-join). It is
 *  the GC's control over an open join link: a stray joiner can be taken out. */
export const CrewPeopleSection = ({ crew }: CrewPeopleSectionProps) => {
  const { members, isLoading, isError, removeMember, isRemoving } = useCrewMembers(crew.id);
  const [removing, setRemoving] = useState<CrewMember | undefined>(undefined);

  const confirmRemove = async () => {
    try {
      await removeMember(removing!.id);
    } catch {
      // useCrewMembers already surfaces the failure as a toast.
    }
    setRemoving(undefined);
  };

  return (
    <StyledSection aria-labelledby="crew-people-title">
      <StyledSectionTitle id="crew-people-title">People</StyledSectionTitle>

      {isLoading && <Spinner message="Loading people…" />}
      {isError && (
        <StyledNote role="alert">Could not load this crew's people. Close and try again.</StyledNote>
      )}
      {!isLoading && !isError && members.length === 0 && (
        <StyledNote>No one has joined yet.</StyledNote>
      )}

      {members.length > 0 && (
        <StyledCrewList>
          {members.map((member) => (
            <StyledCrewRow key={member.id}>
              <StyledMemberName>{member.name}</StyledMemberName>
              <StyledMemberMeta>
                {ROLE_LABELS[member.role]}
                {member.email ? ` · ${member.email}` : ""}
              </StyledMemberMeta>
              <div>
                <Button
                  type="button"
                  variant="danger"
                  size="md"
                  aria-label={`Remove ${member.name}`}
                  onClick={() => setRemoving(member)}
                >
                  Remove
                </Button>
              </div>
            </StyledCrewRow>
          ))}
        </StyledCrewList>
      )}

      <ConfirmDialog
        isOpen={!!removing}
        title={`Remove ${removing?.name ?? "this person"}?`}
        confirmLabel="Remove"
        confirmVariant="danger"
        isBusy={isRemoving}
        onConfirm={confirmRemove}
        onClose={() => setRemoving(undefined)}
      >
        They lose access to {crew.name} right away and their sign-in is deleted. Safety talks they
        ran are kept.
      </ConfirmDialog>
    </StyledSection>
  );
};
