import {
  HiOutlineShieldCheck,
  HiCheckCircle,
  HiExclamationTriangle,
} from "react-icons/hi2";

import { Button } from "../../ui_comps/button";
import type { SealVerification } from "../../interfaces/meetingLog";
import { StyledSealPill, StyledSealRow, StyledTamperedNote } from "./SealBadge.styles";

interface SealBadgeProps {
  meetingId: string;
  /** Whether this meeting has a tamper-evidence content seal at all (Phase
   *  9e) — false for a meeting still in progress, or completed before this
   *  feature shipped. Renders nothing when false: an absent seal makes no
   *  claim either way, so there's nothing to show or verify. */
  sealed: boolean;
  onVerify: (meetingId: string) => void;
  isPending: boolean;
  result?: SealVerification;
  /** The meeting id the shared verify mutation last targeted — see
   *  useVerifyMeetingSeal's comment. Only this row shows `result`/`isPending`. */
  verifyingId?: string;
}

/**
 * A per-row tamper-evidence trust indicator (Phase 9e,
 * docs/tamper-evidence-design.md): a neutral "Sealed" pill plus a "Verify"
 * button that recomputes the meeting's content seal on demand and turns
 * green ("Verified") or red ("Tampered"). Shared between the sub's own
 * Meeting History (`MonthMeetings`) and the GC dashboard's
 * (`SubMeetingsModal`) — the two places a meeting row already shows a
 * PDF-related action.
 */
export const SealBadge = ({
  meetingId,
  sealed,
  onVerify,
  isPending,
  result,
  verifyingId,
}: SealBadgeProps) => {
  if (!sealed) return null;

  const isThisRow = verifyingId === meetingId;
  const pending = isThisRow && isPending;
  const rowResult = isThisRow ? result : undefined;

  return (
    <StyledSealRow>
      <StyledSealPill>
        <HiOutlineShieldCheck aria-hidden="true" />
        Sealed
      </StyledSealPill>
      {rowResult ? (
        <Button
          type="button"
          variant={rowResult.valid ? "success" : "danger"}
          size="sm"
          leftIcon={
            rowResult.valid ? (
              <HiCheckCircle aria-hidden="true" />
            ) : (
              <HiExclamationTriangle aria-hidden="true" />
            )
          }
          loading={pending}
          onClick={() => onVerify(meetingId)}
        >
          {rowResult.valid ? "Verified" : "Tampered"}
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          loading={pending}
          onClick={() => onVerify(meetingId)}
        >
          Verify
        </Button>
      )}
      {rowResult && !rowResult.valid && (
        <StyledTamperedNote role="alert">
          This record's seal no longer matches — it may have been edited after
          completion.
        </StyledTamperedNote>
      )}
    </StyledSealRow>
  );
};
