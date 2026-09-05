import styled from "styled-components";

export const FooterWrapper = styled.footer`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.8rem;
  padding: 3.2rem 1.6rem;
  background-color: ${({ theme }) => theme.colors.navy[800]};
  color: ${({ theme }) => theme.colors.navy[200]};
  text-align: center;
`;

export const FooterMark = styled.p`
  margin: 0;
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: ${({ theme }) => theme.colors.concrete[100]};

  span {
    color: ${({ theme }) => theme.colors.orange[500]};
  }
`;

export const FooterText = styled.p`
  margin: 0;
  font-size: 1.3rem;
  font-weight: 500;
`;
