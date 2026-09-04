import styled from "styled-components";

type Tone = "light" | "dark";

export const StyledBrowserFrame = styled.div<{ $tone: Tone }>`
  width: 100%;
  max-width: 52rem;
  overflow: hidden;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 0.1rem solid
    ${({ theme, $tone }) =>
      $tone === "dark" ? theme.colors.navy[600] : theme.colors.concrete[600]};
  box-shadow: ${({ theme }) => theme.shadows.lg};
  background-color: ${({ theme }) => theme.colors.concrete[100]};
`;

export const StyledBrowserBar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.8rem 1.2rem;
  background-color: ${({ theme }) => theme.colors.concrete[500]};
  border-bottom: 0.1rem solid ${({ theme }) => theme.colors.concrete[600]};
`;

export const StyledDot = styled.span`
  width: 0.9rem;
  height: 0.9rem;
  border-radius: 999rem;
  background-color: ${({ theme }) => theme.colors.concrete[700]};
`;

export const StyledUrlPill = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0.3rem 0.9rem;
  border-radius: 999rem;
  background-color: ${({ theme }) => theme.colors.concrete[100]};
  font-size: 1.1rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.navy[400]};
`;

export const StyledDashBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.6rem;
  padding: 2rem;
`;

export const StyledDashTitle = styled.p`
  margin: 0;
  font-size: 1.6rem;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.navy[700]};
`;

export const StyledStatRow = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.xs}) {
    grid-template-columns: repeat(3, 1fr);
  }
`;

export const StyledStatTile = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 1.2rem;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  background-color: ${({ theme }) => theme.colors.concrete[400]};

  strong {
    font-size: 1.9rem;
    font-weight: 800;
    color: ${({ theme }) => theme.colors.navy[700]};
  }

  span {
    font-size: 1.1rem;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.navy[400]};
  }
`;

export const StyledSubList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
`;

export const StyledSubRow = styled.li<{ $blurred?: boolean }>`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 1.2rem;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  border: 0.1rem solid ${({ theme }) => theme.colors.concrete[600]};
  font-size: 1.25rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.navy[600]};
  filter: ${({ $blurred }) => ($blurred ? "blur(3px)" : "none")};
`;

export const StyledStatusPill = styled.span<{ $tone: "ok" | "alert" }>`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 1.1rem;
  font-weight: 700;
  color: ${({ theme, $tone }) =>
    $tone === "alert" ? theme.colors.red[600] : theme.colors.green[700]};

  svg {
    font-size: 1.4rem;
  }
`;

export const StyledUnlockWrap = styled.div`
  position: relative;
`;

export const StyledUnlockChip = styled.span`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  padding: 0.5rem 1.2rem;
  border-radius: 999rem;
  background-color: ${({ theme }) => theme.colors.orange[500]};
  color: ${({ theme }) => theme.colors.concrete[100]};
  font-size: 1.1rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
`;
