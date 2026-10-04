import { useState } from "react";

import { Button } from "../../ui_comps/button";
import { Checkbox } from "../../ui_comps/checkbox";
import { Modal } from "../../ui_comps/modal";
import { Spinner } from "../../ui_comps/spinner";
import { useOnlineStatus } from "../../context/online-status";
import { useJobsiteMembers } from "../../hooks/useJobsiteMembers";
import { useSetJobsiteMembers } from "../../hooks/useSetJobsiteMembers";
import type { Jobsite } from "../../interfaces/jobsite";
import {
  StyledMembersList,
  StyledMembersRow,
  StyledNote,
  StyledRosterSection,
  StyledUpgradeLink,
  StyledUpgradePrompt,
  StyledUpgradeText,
} from "./styles";

interface JobsiteMembersModalProps {
  jobsite: Jobsite;
  onClose: () => void;
}

/**
 * Assigns superintendents to a jobsite (Phase 9d-2, GC Portfolio only --
 * docs/gc-roles-design.md). A superintendent only sees the jobsites they're
 * assigned here; a Safety Director/Admin already sees every jobsite, so
 * they're not listed. `selected` seeds once from the loaded roster (a manual
 * edit buffer, not derived-in-render state -- the user needs to check/uncheck
 * before saving) and is sent as the full replacement set on Save.
 */
export const JobsiteMembersModal = ({ jobsite, onClose }: JobsiteMembersModalProps) => {
  const { isOnline } = useOnlineStatus();
  const { members, isLoading, isError } = useJobsiteMembers(jobsite.id);
  const { setJobsiteMembers, isSaving, planLimitError } = useSetJobsiteMembers();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [seeded, setSeeded] = useState(false);

  // Seeds `selected` from the roster the moment it finishes loading --
  // adjusting state during render rather than in a useEffect, per
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes.
  // React re-runs this render immediately on the setState call below, before
  // anything paints, so there's no flash of an empty checklist.
  if (!isLoading && !isError && !seeded) {
    setSeeded(true);
    setSelected(
      new Set(members.filter((member) => member.assigned).map((member) => member.userId)),
    );
  }

  const toggle = (userId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    try {
      await setJobsiteMembers({ jobsiteId: jobsite.id, userIds: [...selected] });
      onClose();
    } catch {
      // useSetJobsiteMembers already surfaces the failure as a toast/prompt.
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`${jobsite.name} — superintendents`}>
      <StyledRosterSection>
        <StyledNote>
          Choose which superintendents can see this job site. Admins and Safety
          Directors already see every job site.
        </StyledNote>

        {!isOnline && (
          <StyledNote role="status">
            You're offline. Connect to the internet to update the team.
          </StyledNote>
        )}

        {planLimitError && (
          <StyledUpgradePrompt role="alert">
            <StyledUpgradeText>{planLimitError.message}</StyledUpgradeText>
            <StyledUpgradeLink to="/pricing">See plans</StyledUpgradeLink>
          </StyledUpgradePrompt>
        )}

        {isLoading && <Spinner center message="Loading superintendents…" />}
        {isError && (
          <StyledNote role="alert">
            Could not load superintendents. Refresh to try again.
          </StyledNote>
        )}

        {!isLoading && !isError && members.length === 0 && (
          <StyledNote>
            No superintendents yet. Invite one from Settings, then assign them here.
          </StyledNote>
        )}

        {!isLoading && !isError && members.length > 0 && (
          <StyledMembersList>
            {members.map((member) => (
              <StyledMembersRow key={member.userId}>
                <Checkbox
                  label={member.name}
                  checked={selected.has(member.userId)}
                  disabled={!isOnline}
                  onChange={() => toggle(member.userId)}
                />
              </StyledMembersRow>
            ))}
          </StyledMembersList>
        )}
      </StyledRosterSection>

      {!isLoading && !isError && members.length > 0 && (
        <Button
          type="button"
          variant="primary"
          size="md"
          loading={isSaving}
          disabled={!isOnline}
          onClick={handleSave}
        >
          Save
        </Button>
      )}
    </Modal>
  );
};
