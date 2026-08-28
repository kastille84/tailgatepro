import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Nav,
  Logo,
  LogoText,
  LogoPro,
  NavLinks,
  NavAnchor,
  MenuButton,
} from "./styles";

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
        <NavAnchor to="/about">About</NavAnchor>
        <NavAnchor to="/contact">Contact</NavAnchor>
      </NavLinks>

      <MenuButton
        aria-label="Toggle menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span />
        <span />
        <span />
      </MenuButton>
    </Nav>
  );
};

export default Navbar;
