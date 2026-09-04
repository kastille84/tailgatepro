import styled from "styled-components";

export const StyledPdfCard = styled.div`
  position: relative;
  width: 100%;
  max-width: 30rem;
  aspect-ratio: 8.5 / 11;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  padding: 2rem;
  overflow: hidden;
  background-color: ${({ theme }) => theme.colors.concrete[100]};
  border: 0.1rem solid ${({ theme }) => theme.colors.concrete[600]};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  box-shadow: ${({ theme }) => theme.shadows.lg};
`;

export const StyledPdfHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding-bottom: 0.8rem;
  border-bottom: 0.2rem solid ${({ theme }) => theme.colors.navy[500]};
`;

export const StyledPdfMark = styled.p`
  margin: 0;
  font-size: 1.4rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: ${({ theme }) => theme.colors.navy[700]};

  span {
    color: ${({ theme }) => theme.colors.orange[500]};
  }
`;

export const StyledPdfKicker = styled.p`
  margin: 0;
  font-size: 0.95rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.navy[400]};
`;

export const StyledPdfMeta = styled.dl`
  margin: 0;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.4rem 1.2rem;
  font-size: 1.1rem;

  dt {
    font-weight: 700;
    color: ${({ theme }) => theme.colors.navy[400]};
  }

  dd {
    margin: 0;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.navy[700]};
  }
`;

export const StyledPdfSignatures = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

export const StyledPdfSignatureRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  padding-bottom: 0.3rem;
  border-bottom: 0.1rem solid ${({ theme }) => theme.colors.concrete[600]};
  font-size: 1.05rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.navy[600]};

  svg {
    color: ${({ theme }) => theme.colors.navy[400]};
  }
`;

export const StyledPdfSeal = styled.div`
  position: absolute;
  right: 1.6rem;
  bottom: 3.6rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 6.4rem;
  height: 6.4rem;
  border-radius: 999rem;
  border: 0.2rem solid ${({ theme }) => theme.colors.orange[500]};
  color: ${({ theme }) => theme.colors.orange[600]};
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-align: center;
  text-transform: uppercase;
  transform: rotate(-12deg);
  opacity: 0.9;
`;

export const StyledPdfWatermark = styled.p`
  margin: auto 0 0;
  padding-top: 0.8rem;
  border-top: 0.1rem solid ${({ theme }) => theme.colors.concrete[600]};
  font-size: 1rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.navy[400]};
`;
