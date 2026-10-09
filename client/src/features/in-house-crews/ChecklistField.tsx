import { Checkbox } from "../../ui_comps/checkbox";
import { StyledChecklist, StyledFieldset, StyledLegend } from "./styles";

export interface ChecklistOption {
  id: string;
  label: string;
}

interface ChecklistFieldProps {
  legend: string;
  options: ChecklistOption[];
  /** Ids the user has unticked. Everything else is ticked, so options that
   *  arrive later (or are new) start ticked without any seeding effect. */
  uncheckedIds: string[];
  onToggle: (id: string) => void;
  disabled?: boolean;
}

/** A group of pre-ticked checkboxes: the common case (everything) is zero
 *  taps, and the user unticks what does not apply. Controlled by the caller. */
export const ChecklistField = ({
  legend,
  options,
  uncheckedIds,
  onToggle,
  disabled = false,
}: ChecklistFieldProps) => (
  <StyledFieldset>
    <StyledLegend>{legend}</StyledLegend>
    <StyledChecklist>
      {options.map((option) => (
        <Checkbox
          key={option.id}
          label={option.label}
          checked={!uncheckedIds.includes(option.id)}
          disabled={disabled}
          onChange={() => onToggle(option.id)}
        />
      ))}
    </StyledChecklist>
  </StyledFieldset>
);
