import { useState } from "react";

import { Button } from "../../ui_comps/button";
import { FormField, TextInput } from "../../ui_comps/form";
import { Modal } from "../../ui_comps/modal";
import { RadioGroup } from "../../ui_comps/radio";
import { NO_WORK_DAY_REASONS, NO_WORK_DAY_REASON_LABELS } from "../../data/noWorkDayReasons";
import { useNoWorkDayActions } from "../../hooks/useNoWorkDayActions";
import { useNoWorkDays } from "../../hooks/useNoWorkDays";
import type { NoWorkDayReason } from "../../interfaces/noWorkDay";
import type { Project } from "../../interfaces/project";
import {
  addDays,
  dayOffRange,
  formatDayOff,
  isWeekendDate,
  toLocalDateString,
} from "../../utils/dayOff";
import {
  StyledActions,
  StyledDayOffHeading,
  StyledDayOffHint,
  StyledDayOffItem,
  StyledDayOffItemText,
  StyledDayOffList,
  StyledDayOffQuick,
  StyledLinkNote,
} from "./styles";

interface MarkDayOffModalProps {
  project: Project;
  onClose: () => void;
}

/**
 * "Mark day off" for one project (docs/no-work-days-design.md): the foreman
 * picks a weekday their crew isn't working and a reason, and that day stops
 * counting against the project's compliance on the GC's dashboard and
 * scorecard. Date defaults to today, with Today / Tomorrow quick buttons and a
 * picker limited to the allowed range; weekends are never required so they
 * can't be marked. Marks already made are listed with a Remove action.
 *
 * Works offline: both actions go through the outbox. Rendered only while open
 * so the form starts fresh each time.
 */
export const MarkDayOffModal = ({ project, onClose }: MarkDayOffModalProps) => {
  const [today] = useState(() => toLocalDateString(new Date()));
  const [date, setDate] = useState(today);
  const [reason, setReason] = useState<NoWorkDayReason | null>(null);

  const { noWorkDays } = useNoWorkDays(project.id);
  const { markDayOff, removeDayOff, isMarking, isRemoving } =
    useNoWorkDayActions();

  const { min, max } = dayOffRange(today);
  const isWeekend = isWeekendDate(date);
  const isOutOfRange = date < min || date > max;
  const isAlreadyMarked = noWorkDays.some((day) => day.offDate === date);

  let hint: string | null = null;
  if (isWeekend) {
    hint = "Weekends are never required, so there's nothing to mark. Pick a weekday.";
  } else if (isOutOfRange) {
    hint = "Pick a day from the last 7 days up to 2 weeks ahead.";
  } else if (isAlreadyMarked) {
    hint = "That day is already marked off.";
  }

  const canConfirm = reason !== null && hint === null;

  // Only reachable through the confirm button, which stays disabled until a
  // reason is picked (`canConfirm`), so `chosen` is always set.
  const onConfirm = async (chosen: NoWorkDayReason) => {
    try {
      await markDayOff({ projectId: project.id, offDate: date, reason: chosen });
      onClose();
    } catch {
      // useNoWorkDayActions already surfaces the failure as a toast.
    }
  };

  const onRemove = async (id: string) => {
    try {
      await removeDayOff({ id, projectId: project.id });
    } catch {
      // useNoWorkDayActions already surfaces the failure as a toast.
    }
  };

  const dateFieldId = "day-off-date";

  return (
    <Modal isOpen onClose={onClose} title={`${project.name} — mark day off`}>
      <StyledLinkNote>
        Your crew isn't working this day? Mark it off and it won't count as a
        missed safety talk. If you hold a talk that day anyway, it still counts.
      </StyledLinkNote>

      <StyledDayOffQuick>
        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={() => setDate(today)}
        >
          Today
        </Button>
        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={() => setDate(addDays(today, 1))}
        >
          Tomorrow
        </Button>
      </StyledDayOffQuick>

      <FormField id={dateFieldId} label="Day">
        <TextInput
          id={dateFieldId}
          type="date"
          value={date}
          min={min}
          max={max}
          onChange={(event) => {
            if (event.target.value) setDate(event.target.value);
          }}
        />
      </FormField>
      {hint && <StyledDayOffHint role="alert">{hint}</StyledDayOffHint>}

      <RadioGroup
        name="day-off-reason"
        ariaLabel="Reason"
        options={NO_WORK_DAY_REASONS}
        value={reason}
        onChange={setReason}
      />

      <StyledActions>
        <Button type="button" variant="outline" size="md" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          size="md"
          loading={isMarking}
          disabled={!canConfirm}
          onClick={() => onConfirm(reason as NoWorkDayReason)}
        >
          {`Mark ${formatDayOff(date)} off`}
        </Button>
      </StyledActions>

      {noWorkDays.length > 0 && (
        <>
          <StyledDayOffHeading>Already marked off</StyledDayOffHeading>
          <StyledDayOffList aria-label="Days already marked off">
            {noWorkDays.map((day) => (
              <StyledDayOffItem key={day.id}>
                <StyledDayOffItemText>
                  {formatDayOff(day.offDate)} · {NO_WORK_DAY_REASON_LABELS[day.reason]}
                </StyledDayOffItemText>
                {day.offDate >= min && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isRemoving}
                    aria-label={`Remove ${formatDayOff(day.offDate)} day off`}
                    onClick={() => onRemove(day.id)}
                  >
                    Remove
                  </Button>
                )}
              </StyledDayOffItem>
            ))}
          </StyledDayOffList>
        </>
      )}
    </Modal>
  );
};
