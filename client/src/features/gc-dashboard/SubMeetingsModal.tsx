import { Button } from "../../ui_comps/button";
import { Modal } from "../../ui_comps/modal";
import { Spinner } from "../../ui_comps/spinner";
import { useOnlineStatus } from "../../context/online-status";
import { useGcMeetings } from "../../hooks/useGcMeetings";
import { useGcMeetingPdfUrl } from "../../hooks/useGcMeetingPdfUrl";
import type { GcSubCompliance } from "../../interfaces/gcDashboard";
import {
  StyledEmpty,
  StyledError,
  StyledMeetingDate,
  StyledMeetingList,
  StyledMeetingMeta,
  StyledMeetingRow,
  StyledMeetingTitle,
  StyledOfflineNote,
} from "./styles";

interface SubMeetingsModalProps {
  /** The sub being drilled into, or `undefined` when the modal should be
   *  closed. */
  sub: GcSubCompliance | undefined;
  onClose: () => void;
}

/**
 * A subcontractor's recent completed meeting logs, opened from
 * `SubComplianceRow`. Online-only, same as the rest of the GC dashboard — no
 * request is made while `sub` is undefined (the modal is closed).
 */
export const SubMeetingsModal = ({ sub, onClose }: SubMeetingsModalProps) => {
  const { isOnline } = useOnlineStatus();
  const { meetings, isLoading, isError } = useGcMeetings(
    { projectId: sub?.projectId ?? undefined },
    // No project to drill into means no request — an empty projectId filter
    // would otherwise list every one of the GC's meetings.
    Boolean(sub?.projectId),
  );
  const { openPdf, isPending } = useGcMeetingPdfUrl();

  return (
    <Modal isOpen={Boolean(sub)} onClose={onClose} title={sub?.companyName ?? ""}>
      {!isOnline && (
        <StyledOfflineNote role="status">
          You're offline. Reconnect to see this sub's recent logs.
        </StyledOfflineNote>
      )}

      {isLoading && <Spinner center message="Loading recent logs…" />}
      {isError && (
        <StyledError role="alert">
          Could not load this sub's logs. Refresh to try again.
        </StyledError>
      )}
      {!isLoading && !isError && meetings.length === 0 && (
        <StyledEmpty>No completed talks logged yet.</StyledEmpty>
      )}
      {!isLoading && !isError && meetings.length > 0 && (
        <StyledMeetingList>
          {meetings.map((meeting) => (
            <StyledMeetingRow key={meeting.id}>
              <StyledMeetingMeta>
                <StyledMeetingTitle>
                  {meeting.talkTitle ?? "Untitled talk"}
                </StyledMeetingTitle>
                <StyledMeetingDate>
                  {new Date(meeting.heldAt).toLocaleString()} ·{" "}
                  {meeting.signerCount}{" "}
                  {meeting.signerCount === 1 ? "signer" : "signers"}
                </StyledMeetingDate>
              </StyledMeetingMeta>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!meeting.pdfReady || !isOnline}
                loading={isPending}
                onClick={() => openPdf(meeting.id)}
              >
                {meeting.pdfReady ? "Open PDF" : "PDF pending"}
              </Button>
            </StyledMeetingRow>
          ))}
        </StyledMeetingList>
      )}
    </Modal>
  );
};
