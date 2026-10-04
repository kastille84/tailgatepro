import styled from "styled-components";

export const StyledConfirmBody = styled.p`
  margin: 0 0 1.6rem;
  font-size: 1.5rem;
  font-weight: 500;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.navy[600]};
`;

export const StyledConfirmActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 1.2rem;
  margin-top: 0.8rem;
`;
