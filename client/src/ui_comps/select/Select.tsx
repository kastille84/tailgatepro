import type { ComponentPropsWithoutRef, ReactNode, Ref } from "react";
import { HiChevronDown } from "react-icons/hi2";

import { StyledChevron, StyledSelect, StyledWrapper } from "./styles";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends ComponentPropsWithoutRef<"select"> {
  hasError?: boolean;
  /** Convenience: render `<option>`s from data. Ignored when `children` given. */
  options?: SelectOption[];
  /** Optional leading placeholder rendered as a disabled first option. */
  placeholder?: string;
  ref?: Ref<HTMLSelectElement>;
  children?: ReactNode;
}

/**
 * A styled native `<select>`. All remaining props (including the `id` /
 * `hasError` / `aria-*` that `FormField` injects and the `name` / `onChange` /
 * `onBlur` / `ref` from react-hook-form's `register`) are forwarded to the
 * underlying element.
 */
export const Select = ({
  hasError = false,
  options,
  placeholder,
  children,
  ref,
  defaultValue,
  value,
  ...props
}: SelectProps) => {
  // A placeholder only works as the initial selection when the field is
  // uncontrolled and has no explicit default.
  const resolvedDefault =
    value === undefined && defaultValue === undefined && placeholder
      ? ""
      : defaultValue;

  return (
    <StyledWrapper>
      <StyledSelect
        ref={ref}
        $hasError={hasError}
        aria-invalid={hasError || undefined}
        value={value}
        defaultValue={resolvedDefault}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {children ??
          options?.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
      </StyledSelect>
      <StyledChevron>
        <HiChevronDown aria-hidden="true" />
      </StyledChevron>
    </StyledWrapper>
  );
};
