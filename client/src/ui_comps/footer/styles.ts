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

export const FooterLinks = styled.nav`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.4rem 2.4rem;
`;

export const FooterLink = styled.a`
  display: inline-flex;
  align-items: center;
  min-height: 4.8rem;
  font-size: 1.3rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.navy[200]};

  &:hover {
    color: ${({ theme }) => theme.colors.concrete[100]};
  }
`;
