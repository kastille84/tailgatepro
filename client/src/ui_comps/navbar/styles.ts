import styled from "styled-components";
import { Link } from "react-router-dom";

export const Nav = styled.header`
  position: sticky;
  top: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  background: ${({ theme }) => theme.colors.navy[500]};
  color: ${({ theme }) => theme.colors.concrete[100]};
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  backdrop-filter: blur(6px);
`;

export const Logo = styled(Link)`
  display: inline-flex;
  align-items: center;
  text-decoration: none;
  gap: 10px;
  img {
    height: 40px;
    width: auto;
    display: block;
  }
  color: ${({ theme }) => theme.colors.concrete[100]};
`;

export const LogoText = styled.span`
  font-size: 18px;
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
  gap: 18px;

  a {
    color: ${({ theme }) => theme.colors.orange[500]};
    text-decoration: none;
    font-weight: 600;
    padding: 8px 6px;
    border-radius: 6px;
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    position: absolute;
    left: 0;
    right: 0;
    top: 100%;
    display: ${(p) => (p.$open ? "flex" : "none")};
    flex-direction: column;
    background: ${({ theme }) => theme.colors.navy[700]};
    padding: 12px 16px 20px;
    gap: 8px;
    box-shadow: ${({ theme }) => theme.shadows.md};
  }
`;

export const NavAnchor = styled(Link)`
  color: inherit;
  &:hover {
    opacity: 0.9;
  }
`;

export const MenuButton = styled.button`
  display: none;
  background: transparent;
  border: 0;
  padding: 8px;
  width: 44px;
  height: 44px;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  span {
    display: block;
    height: 2px;
    width: 20px;
    background: ${({ theme }) => theme.colors.concrete[100]};
    margin: 3px 0;
    border-radius: 2px;
  }

  @media (max-width: 720px) {
    display: inline-flex;
  }
`;

export default Nav;
