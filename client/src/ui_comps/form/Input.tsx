import React from "react";
import styled from "styled-components";

interface InputProps extends React.ComponentPropsWithoutRef<"input"> {
  hasError?: boolean;
  ref?: React.Ref<HTMLInputElement>;
}

const StyledInput = styled.input<{ $hasError?: boolean }>`
  width: 100%;
  padding: 0.75rem 0.875rem;
  border: 0.1rem solid
    ${({ theme, $hasError }) =>
      $hasError ? theme.colors.red[500] : theme.colors.navy[200]};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: ${({ theme }) => theme.colors.concrete[100]};
  color: ${({ theme }) => theme.colors.navy[700]};
  font-size: 1rem;
  line-height: 1.5;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  &::placeholder {
    color: ${({ theme }) => theme.colors.navy[400]};
  }

  &:focus {
    outline: none;
    border-color: ${({ theme, $hasError }) =>
      $hasError ? theme.colors.red[500] : theme.colors.green[500]};
    box-shadow: 0 0 0 0.3rem
      ${({ $hasError }) =>
        $hasError ? "rgba(211, 47, 47, 0.15)" : "rgba(85, 161, 102, 0.15)"};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.65;
    background-color: ${({ theme }) => theme.colors.concrete[400]};
  }
`;

export const Input = ({ hasError = false, ref, ...props }: InputProps) => {
  return (
    <StyledInput
      ref={ref}
      $hasError={hasError}
      aria-invalid={hasError}
      {...props}
    />
  );
};

export const Form = styled.form<{ $onDark?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 1.6rem;
  width: 100%;
  text-align: left;
`;

export const FieldRow = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.6rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

export const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
`;

export const Label = styled.label<{ $onDark?: boolean }>`
  font-size: 1.4rem;
  font-weight: 700;
  color: ${({ theme, $onDark }) =>
    $onDark ? theme.colors.concrete[200] : theme.colors.navy[600]};

  span {
    font-weight: 500;
    opacity: 0.7;
  }
`;

export const TextInput = styled(Input)`
  && {
    font-size: 1.6rem;
    min-height: 4.8rem;
    padding: 1.2rem 1.4rem;
  }
`;

export const FieldError = styled.p<{ $onDark?: boolean }>`
  margin: 0;
  font-size: 1.3rem;
  font-weight: 600;
  color: ${({ theme, $onDark }) =>
    $onDark ? theme.colors.red[200] : theme.colors.red[600]};
`;

export const FieldHint = styled.p<{ $onDark?: boolean }>`
  margin: 0;
  font-size: 1.25rem;
  font-weight: 500;
  line-height: 1.5;
  color: ${({ theme, $onDark }) =>
    $onDark ? theme.colors.concrete[300] : theme.colors.navy[500]};
`;

interface FormFieldProps extends React.ComponentPropsWithoutRef<"div"> {
  id: string;
  label: React.ReactNode;
  helperText?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  onDark?: boolean;
  children: React.ReactNode;
}

export const FormField = ({
  id,
  label,
  helperText,
  hint,
  error,
  onDark,
  children,
  ...props
}: FormFieldProps) => {
  const fieldErrorId = `${id}-error`;
  const child = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement, {
        id: (children as React.ReactElement).props.id ?? id,
        hasError:
          Boolean(error) ||
          Boolean((children as React.ReactElement).props.hasError),
        "aria-invalid":
          Boolean(error) ||
          Boolean((children as React.ReactElement).props["aria-invalid"]),
        "aria-describedby":
          [
            (children as React.ReactElement).props["aria-describedby"],
            error ? fieldErrorId : undefined,
          ]
            .filter(Boolean)
            .join(" ") || undefined,
      })
    : children;

  const helperNode = helperText ?? hint;

  return (
    <Field {...props}>
      <Label htmlFor={id} $onDark={onDark}>
        {label}
      </Label>
      {helperNode && (
        <FieldHint $onDark={onDark} aria-live="polite">
          {helperNode}
        </FieldHint>
      )}
      {child}
      {error && (
        <FieldError id={fieldErrorId} role="alert" $onDark={onDark}>
          {error}
        </FieldError>
      )}
    </Field>
  );
};
