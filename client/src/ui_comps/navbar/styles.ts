import styled from "styled-components";
import { Link } from "react-router-dom";

export const Nav = styled.header`
  position: sticky;
  top: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.6rem;
  padding: 1.2rem 1.6rem;
  background: ${({ theme }) => theme.colors.navy[500]};
  color: ${({ theme }) => theme.colors.concrete[100]};
  border-bottom: 0.1rem solid rgba(0, 0, 0, 0.06);
  backdrop-filter: blur(0.6rem);
`;

export const Logo = styled(Link)`
  display: inline-flex;
  align-items: center;
  text-decoration: none;
  gap: 1rem;
  img {
    height: 4rem;
    width: auto;
    display: block;
  }
  color: ${({ theme }) => theme.colors.concrete[100]};
`;

export const LogoText = styled.span`
  font-size: 1.8rem;
  font-weight: 700;
  line-height: 1;
  display: inline-flex;
  align-items: baseline;
`;

export const LogoPro = styled.span`
  color: ${({ theme }) => theme.colors.orange[500]};
`;

export const NavLinks = styled.nav<{ $open?: boolean }>`
  display: flex;
  align-items: center;
  gap: 1.8rem;

  a {
    color: ${({ theme }) => theme.colors.orange[500]};
    text-decoration: none;
    font-weight: 600;
    padding: 0.8rem 0.6rem;
    border-radius: 0.6rem;
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    position: absolute;
    left: 0;
    right: 0;
    top: 100%;
    display: ${(p) => (p.$open ? "flex" : "none")};
    flex-direction: column;
    background: ${({ theme }) => theme.colors.navy[700]};
    padding: 1.2rem 1.6rem 2rem;
    gap: 0.8rem;
    box-shadow: ${({ theme }) => theme.shadows.md};
  }
`;

export const NavAnchor = styled(Link)`
  color: inherit;
  &:hover {
    opacity: 0.9;
  }
`;

export const MenuButton = styled.button<{ $open?: boolean }>`
  display: none;
  background: transparent;
  border: 0;
  padding: 0.8rem;
  width: 4.4rem;
  height: 4.4rem;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;

  span {
    position: absolute;
    left: 50%;
    top: 50%;
    display: block;
    height: 0.2rem;
    width: 2rem;
    background: ${({ theme }) => theme.colors.concrete[100]};
    border-radius: 0.2rem;
    transform-origin: center;
    transition:
      transform 180ms ease,
      opacity 180ms ease;
  }

  span:nth-child(1) {
    transform: translate(-50%, -50%)
      rotate(${(p) => (p.$open ? "45deg" : "0deg")});
  }

  span:nth-child(2) {
    transform: translate(-50%, -50%)
      rotate(${(p) => (p.$open ? "-45deg" : "90deg")});
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    display: inline-flex;
  }
`;

export default Nav;
