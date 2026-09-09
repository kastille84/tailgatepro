import React, { useState } from "react";
import {
  Nav,
  Logo,
  LogoText,
  LogoPro,
  NavLinks,
  NavAnchor,
  MenuButton,
} from "./styles";
import { Button } from "../button";
import { useAuth } from "../../context/auth";
import { InstallButton } from "../../features/pwa-install";

export const Navbar: React.FC = () => {
  const [open, setOpen] = useState(false);
  const { user, loading, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  // When the navbar is collapsed into the mobile dropdown, collapse it again as
  // soon as any link / button inside it is activated. Harmless no-op on wide
  // viewports where the links are always visible.
  const handleNavLinksClick = (event: React.MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("a, button")) {
      setOpen(false);
    }
  };

  return (
    <Nav role="navigation" aria-label="Main navigation">
      <Logo to="/">
        <img src="/images/logo/Logo.png" alt="TailgatePro" />
        <LogoText>
          TAILGATE<LogoPro>PRO</LogoPro>
        </LogoText>
      </Logo>

      <NavLinks $open={open} onClick={handleNavLinksClick}>
        {!user && (
          <>
            <NavAnchor to="/landing">Home</NavAnchor>
            {/* <NavAnchor to="/faq">FAQ</NavAnchor> */}
            <NavAnchor to="/pricing">Pricing</NavAnchor>
            {/* <NavAnchor to="/contact">Contact</NavAnchor> */}
          </>
        )}

        {!loading && user && (
          <>
            <NavAnchor to="/dashboard">Dashboard</NavAnchor>
            <NavAnchor to="/projects">Projects</NavAnchor>
            <Button
              size="sm"
              variant="outline"
              onClick={handleLogout}
              loading={isLoggingOut}
            >
              Logout
            </Button>
          </>
        )}

        {!loading && !user && (
          <>
            <NavAnchor to="/login">
              <Button size="sm" variant="outline">
                Login
              </Button>
            </NavAnchor>
            <NavAnchor to="/signup">
              <Button size="sm">Sign Up</Button>
            </NavAnchor>
          </>
        )}

        <InstallButton size="sm" variant="success" />
      </NavLinks>

      <MenuButton
        $open={open}
        aria-label="Toggle menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span />
        <span />
      </MenuButton>
    </Nav>
  );
};

export default Navbar;
