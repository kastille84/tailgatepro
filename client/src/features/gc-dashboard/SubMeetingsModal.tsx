import { useId, useState } from "react";

import { Button } from "../../ui_comps/button";
import { FormField, TextInput } from "../../ui_comps/form";
import { Modal } from "../../ui_comps/modal";
import { Spinner } from "../../ui_comps/spinner";
import { useOnlineStatus } from "../../context/online-status";
import { useGcMeetings } from "../../hooks/useGcMeetings";
import { useGcMeetingPdfUrl } from "../../hooks/useGcMeetingPdfUrl";
import { useVerifyGcMeetingSeal } from "../../hooks/useVerifyGcMeetingSeal";
import { SealBadge } from "../meeting-shared/SealBadge";
import type { GcSubCompliance } from "../../interfaces/gcDashboard";
import {
  StyledDateFilter,
  StyledEmpty,
  StyledError,
  StyledMeetingActions,
  StyledMeetingDate,
  StyledLoadMore,
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

/** ISO timestamp for local midnight of a `YYYY-MM-DD` date, `plusDays` later.
 *  Parsed as local time so the range matches the GC's own calendar days. */
const startOfLocalDay = (date: string, plusDays = 0) => {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day + plusDays).toISOString();
};

/**
 * A subcontractor's recent completed meeting logs, opened from
 * `SubComplianceRow`. Online-only, same as the rest of the GC dashboard — no
 * request is made while `sub` is undefined (the modal is closed).
 */
export const SubMeetingsModal = ({ sub, onClose }: SubMeetingsModalProps) => {
  const { isOnline } = useOnlineStatus();
  const fromId = useId();
  const toId = useId();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const isFiltered = Boolean(fromDate || toDate);
  const {
    meetings,
    isLoading,
    isError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useGcMeetings(
    {
      projectId: sub?.projectId ?? undefined,
      ...(fromDate && { from: startOfLocalDay(fromDate) }),
      // The server's `to` is exclusive, so the picked day is included by
      // sending the start of the day after it.
      ...(toDate && { to: startOfLocalDay(toDate, 1) }),
    },
    // No project to drill into means no request — an empty projectId filter
    // would otherwise list every one of the GC's meetings.
    Boolean(sub?.projectId),
  );
  const { openPdf, isPending } = useGcMeetingPdfUrl();
  const {
    verifySeal,
    result: sealResult,
    isPending: sealPending,
    verifyingId,
  } = useVerifyGcMeetingSeal();

  const handleClose = () => {
    setFromDate("");
    setToDate("");
    onClose();
  };

  return (
    <Modal isOpen={Boolean(sub)} onClose={handleClose} title={sub?.companyName ?? ""}>
      {!isOnline && (
        <StyledOfflineNote role="status">
          You're offline. Reconnect to see this sub's recent logs.
        </StyledOfflineNote>
      )}

      <StyledDateFilter>
        <FormField id={fromId} label="From">
          <TextInput
            id={fromId}
            type="date"
            value={fromDate}
            max={toDate || undefined}
            onChange={(event) => setFromDate(event.target.value)}
          />
        </FormField>
        <FormField id={toId} label="To">
          <TextInput
            id={toId}
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(event) => setToDate(event.target.value)}
          />
        </FormField>
        {isFiltered && (
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={() => {
              setFromDate("");
              setToDate("");
            }}
          >
            Clear dates
          </Button>
        )}
      </StyledDateFilter>

      {isLoading && <Spinner center message="Loading recent logs…" />}
      {isError && (
        <StyledError role="alert">
          Could not load this sub's logs. Refresh to try again.
        </StyledError>
      )}
      {!isLoading && !isError && meetings.length === 0 && (
        <StyledEmpty>
          {isFiltered
            ? "No completed talks in this date range."
            : "No completed talks logged yet."}
        </StyledEmpty>
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
              <StyledMeetingActions>
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
                <SealBadge
                  meetingId={meeting.id}
                  sealed={meeting.sealed}
                  onVerify={verifySeal}
                  isPending={sealPending}
                  result={sealResult}
                  verifyingId={verifyingId}
                />
              </StyledMeetingActions>
            </StyledMeetingRow>
          ))}
        </StyledMeetingList>
      )}
      {!isLoading && !isError && hasNextPage && (
        <StyledLoadMore>
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={isFetchingNextPage}
            disabled={!isOnline}
            onClick={() => fetchNextPage()}
          >
            Load more
          </Button>
        </StyledLoadMore>
      )}
    </Modal>
  );
};
