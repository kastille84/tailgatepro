import styled from "styled-components";

export const StyledAuthStatus = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 40vh;
  padding: 4.8rem 1.6rem;
  font-size: 1.5rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.navy[400]};
`;
