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
