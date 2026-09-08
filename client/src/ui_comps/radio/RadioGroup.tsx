import {
  StyledGroup,
  StyledOption,
  StyledOptionText,
  StyledRadio,
} from "./styles";

interface RadioOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

interface RadioGroupProps<T extends string> {
  /** Shared `name` for the underlying radio inputs. */
  name: string;
  options: RadioOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  /** Accessible name for the group. */
  ariaLabel: string;
  hasError?: boolean;
  disabled?: boolean;
}

/**
 * A vertical set of native radio inputs — one selectable at a time. Controlled:
 * pass `value` and handle `onChange`. Pairs with react-hook-form via
 * `<Controller>`.
 */
export const RadioGroup = <T extends string>({
  name,
  options,
  value,
  onChange,
  ariaLabel,
  hasError = false,
  disabled = false,
}: RadioGroupProps<T>) => (
  <StyledGroup
    role="radiogroup"
    aria-label={ariaLabel}
    aria-invalid={hasError || undefined}
  >
    {options.map((option) => {
      const optionDisabled = disabled || option.disabled;

      return (
        <StyledOption key={option.value} $disabled={optionDisabled}>
          <StyledRadio
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            disabled={optionDisabled}
            $hasError={hasError}
            onChange={() => onChange(option.value)}
          />
          <StyledOptionText>{option.label}</StyledOptionText>
        </StyledOption>
      );
    })}
  </StyledGroup>
);
