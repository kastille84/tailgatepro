import { StyledGroup, StyledOption } from "./styles";

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedToggleProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the button group. */
  ariaLabel: string;
}

/** A segmented control: a row of mutually exclusive options, one active. */
export const SegmentedToggle = <T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: SegmentedToggleProps<T>) => (
  <StyledGroup role="group" aria-label={ariaLabel}>
    {options.map((option) => (
      <StyledOption
        key={option.value}
        type="button"
        $active={option.value === value}
        aria-pressed={option.value === value}
        onClick={() => onChange(option.value)}
      >
        {option.label}
      </StyledOption>
    ))}
  </StyledGroup>
);
