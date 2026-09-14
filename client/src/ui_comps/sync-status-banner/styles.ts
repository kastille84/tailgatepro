import styled from "styled-components";

export const StyledBanner = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 1.2rem;
  padding: 0.8rem 1.6rem;
  font-size: 1.4rem;
  font-weight: 600;
  text-align: center;
  color: ${({ theme }) => theme.colors.red[400]};
  background-color: ${({ theme }) => theme.colors.navy[700]};
`;
