import type { MeetingMonth } from "../../services/apiMeetingLogs";
import { formatMonth } from "./monthUtils";
import {
  StyledEmpty,
  StyledMonthCard,
  StyledMonthCount,
  StyledMonthGrid,
  StyledMonthName,
} from "./styles";

interface MonthCardsProps {
  months: MeetingMonth[];
  onSelect: (month: string) => void;
}

/** One card per archive month ("September 2026 · 23 talks"), newest first.
 *  Picking a card opens that month's talks instead of loading the whole
 *  archive at once. */
export const MonthCards = ({ months, onSelect }: MonthCardsProps) => {
  if (months.length === 0) {
    return <StyledEmpty>No completed meetings yet.</StyledEmpty>;
  }

  return (
    <StyledMonthGrid>
      {months.map(({ month, count }) => (
        <li key={month}>
          <StyledMonthCard type="button" onClick={() => onSelect(month)}>
            <StyledMonthName>{formatMonth(month)}</StyledMonthName>
            <StyledMonthCount>
              {count} {count === 1 ? "talk" : "talks"}
            </StyledMonthCount>
          </StyledMonthCard>
        </li>
      ))}
    </StyledMonthGrid>
  );
};
