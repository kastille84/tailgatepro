import styled from "styled-components";

export const StyledEmpty = styled.p`
  margin: 0;
  padding: 2.4rem 1.6rem;
  text-align: center;
  font-size: 1.5rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.navy[400]};
`;

export const StyledError = styled.p`
  margin: 0;
  padding: 2.4rem 1.6rem;
  text-align: center;
  font-size: 1.5rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.red[600]};
`;

export const StyledMonthGrid = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.2rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

export const StyledMonthCard = styled.button`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  width: 100%;
  min-height: 8rem;
  padding: 1.6rem 2rem;
  border: 0;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: ${({ theme }) => theme.colors.concrete[100]};
  text-align: left;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    box-shadow: ${({ theme }) => theme.shadows.md};
  }
`;

export const StyledMonthName = styled.span`
  font-size: 1.8rem;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.navy[700]};
`;

export const StyledMonthCount = styled.span`
  font-size: 1.4rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.navy[500]};
`;

export const StyledMonthHeader = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1.2rem;
  margin-bottom: 1.6rem;
`;

export const StyledMonthTitle = styled.h2`
  margin: 0;
  font-size: 2.2rem;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.navy[700]};
`;

export const StyledList = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
`;

export const StyledRow = styled.li`
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  padding: 1.6rem 2rem;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: ${({ theme }) => theme.colors.concrete[100]};

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
`;

export const StyledRowInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`;

export const StyledRowTitle = styled.p`
  margin: 0;
  font-size: 1.6rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.navy[700]};
`;

export const StyledRowMeta = styled.p`
  margin: 0;
  font-size: 1.4rem;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.navy[500]};
`;
