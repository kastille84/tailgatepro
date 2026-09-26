import { HiOutlineArrowLeft, HiOutlineDocumentText } from "react-icons/hi2";

import { useMeetingLogs } from "../../hooks/useMeetingLogs";
import { useMeetingPdfUrl } from "../../hooks/useMeetingPdfUrl";
import { useProjects } from "../../hooks/useProjects";
import { useTalks } from "../../hooks/useTalks";
import { Button } from "../../ui_comps/button";
import { Spinner } from "../../ui_comps/spinner";
import { formatMonth, monthRange } from "./monthUtils";
import {
  StyledEmpty,
  StyledError,
  StyledList,
  StyledMonthHeader,
  StyledMonthTitle,
  StyledRow,
  StyledRowInfo,
  StyledRowMeta,
  StyledRowTitle,
} from "./styles";

interface MonthMeetingsProps {
  /** `YYYY-MM`, already validated by the caller. */
  month: string;
  onBack: () => void;
}

const formatHeldAt = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

/** The completed talks for one archive month, each with a signed-PDF button.
 *  Fetches only that month's range, so the archive never loads all at once. */
export const MonthMeetings = ({ month, onBack }: MonthMeetingsProps) => {
  const { meetings, isLoading, isError } = useMeetingLogs(monthRange(month));
  const { projects } = useProjects();
  const { talks } = useTalks();
  const { openPdf, isPending } = useMeetingPdfUrl();

  return (
    <>
      <StyledMonthHeader>
        <Button
          variant="outline"
          size="md"
          leftIcon={<HiOutlineArrowLeft />}
          onClick={onBack}
        >
          All months
        </Button>
        <StyledMonthTitle>{formatMonth(month)}</StyledMonthTitle>
      </StyledMonthHeader>

      {isLoading && <Spinner center message="Loading this month…" />}
      {isError && (
        <StyledError role="alert">
          Could not load this month. Refresh to try again.
        </StyledError>
      )}
      {!isLoading && !isError && meetings.length === 0 && (
        <StyledEmpty>No completed meetings this month.</StyledEmpty>
      )}
      {!isLoading && !isError && meetings.length > 0 && (
        <StyledList>
          {meetings.map((meeting) => {
            const project = projects.find((p) => p.id === meeting.projectId);
            const talk = talks.find((t) => t.id === meeting.talkId);
            return (
              <StyledRow key={meeting.id}>
                <StyledRowInfo>
                  <StyledRowTitle>{talk?.title ?? "Untitled talk"}</StyledRowTitle>
                  <StyledRowMeta>
                    {project?.name ?? "Unknown project"} ·{" "}
                    {formatHeldAt(meeting.heldAt ?? meeting.createdAt)}
                  </StyledRowMeta>
                </StyledRowInfo>
                {meeting.finalPdfUrl ? (
                  <Button
                    variant="outline"
                    size="md"
                    leftIcon={<HiOutlineDocumentText />}
                    disabled={isPending}
                    onClick={() => openPdf(meeting.id)}
                  >
                    Open PDF
                  </Button>
                ) : (
                  <StyledRowMeta>PDF pending</StyledRowMeta>
                )}
              </StyledRow>
            );
          })}
        </StyledList>
      )}
    </>
  );
};
