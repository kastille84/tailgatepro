import styled from "styled-components";

type Tone = "light" | "dark";

export const StyledPhoneFrame = styled.div<{ $tone: Tone }>`
  position: relative;
  width: 100%;
  max-width: 22rem;
  aspect-ratio: 9 / 19;
  padding: 0.8rem;
  border-radius: 3rem;
  background-color: ${({ theme, $tone }) =>
    $tone === "dark" ? theme.colors.navy[800] : theme.colors.navy[700]};
  border: 0.2rem solid
    ${({ theme, $tone }) =>
      $tone === "dark" ? theme.colors.navy[600] : theme.colors.navy[500]};
  box-shadow: ${({ theme }) => theme.shadows.lg};

  &::before {
    content: "";
    position: absolute;
    top: 1.4rem;
    left: 50%;
    transform: translateX(-50%);
    width: 6rem;
    height: 0.6rem;
    border-radius: 999rem;
    background-color: ${({ theme }) => theme.colors.navy[500]};
    z-index: 1;
  }
`;

export const StyledPhoneScreen = styled.div`
  position: absolute;
  inset: 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  padding: 2.4rem 1.4rem 1.6rem;
  overflow: hidden;
  border-radius: 2.2rem;
  background-color: ${({ theme }) => theme.colors.concrete[100]};
`;

export const StyledStatusBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 1rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.navy[400]};
`;

export const StyledScreenHeader = styled.p`
  margin: 0;
  font-size: 1.3rem;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.navy[700]};
`;

export const StyledTopicRow = styled.div<{ $selected?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  padding: 0.7rem 0.8rem;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: 1.15rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.navy[600]};
  background-color: ${({ theme, $selected }) =>
    $selected ? theme.colors.orange[100] : theme.colors.concrete[400]};
  border: 0.1rem solid
    ${({ theme, $selected }) =>
      $selected ? theme.colors.orange[400] : "transparent"};

  svg {
    flex-shrink: 0;
    font-size: 1.3rem;
    color: ${({ theme }) => theme.colors.orange[600]};
  }
`;

export const StyledSignRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding-bottom: 0.4rem;
  border-bottom: 0.1rem solid ${({ theme }) => theme.colors.concrete[600]};

  span {
    font-size: 1.1rem;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.navy[500]};
  }

  svg {
    color: ${({ theme }) => theme.colors.navy[400]};
  }
`;

export const StyledSubmitted = styled.div`
  margin: auto 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.8rem;
  text-align: center;

  svg {
    font-size: 4rem;
    color: ${({ theme }) => theme.colors.green[600]};
  }
`;

export const StyledSubmittedTitle = styled.p`
  margin: 0;
  font-size: 1.4rem;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.navy[700]};
`;

export const StyledSubmittedMeta = styled.p`
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.navy[400]};
`;
