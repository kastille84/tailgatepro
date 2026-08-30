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

export const Navbar: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <Nav role="navigation" aria-label="Main navigation">
      <Logo to="/">
        <img src="/images/logo/Logo.png" alt="TailgatePro" />
        <LogoText>
          TAILGATE<LogoPro>PRO</LogoPro>
        </LogoText>
      </Logo>

      <NavLinks $open={open}>
        <NavAnchor to="/landing">Home</NavAnchor>
        <NavAnchor to="/faq">FAQ</NavAnchor>
        <NavAnchor to="/pricing">Pricing</NavAnchor>
        <NavAnchor to="/contact">Contact</NavAnchor>
        <NavAnchor>
          <Button size="sm" variant="outline">
            Login
          </Button>
        </NavAnchor>
        <NavAnchor to="/signup">
          <Button size="sm">Sign Up</Button>
        </NavAnchor>
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
