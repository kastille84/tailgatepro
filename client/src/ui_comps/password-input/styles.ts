import styled from "styled-components";

import { TextInput } from "../form";

export const StyledWrapper = styled.div`
  position: relative;
  width: 100%;
`;

export const StyledPasswordInput = styled(TextInput)<{ $hasToggle: boolean }>`
  && {
    ${({ $hasToggle }) => ($hasToggle ? "padding-right: 5.2rem;" : "")}
  }
`;

/* Sits over the input's white background, so the icon stays dark on every page.
   Full-height, >= 4.8rem wide keeps a gloved-hand tap target. */
export const StyledToggleButton = styled.button`
  position: absolute;
  top: 0;
  right: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 4.8rem;
  min-height: 4.8rem;
  height: 100%;
  padding: 0;
  border: 0;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  background: transparent;
  color: ${({ theme }) => theme.colors.navy[400]};
  font-size: 2rem;
  cursor: pointer;

  &:hover {
    color: ${({ theme }) => theme.colors.navy[600]};
  }

  &:focus-visible {
    outline: 0.2rem solid ${({ theme }) => theme.colors.orange[500]};
    outline-offset: -0.2rem;
  }
`;
