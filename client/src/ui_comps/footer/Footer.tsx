import {
  FooterLink,
  FooterLinks,
  FooterMark,
  FooterText,
  FooterWrapper,
} from "./styles";

interface FooterProps {
  year?: number;
  text?: string;
}

export const Footer = ({
  year = new Date().getFullYear(),
  text = "Digital Toolbox Safety Talks",
}: FooterProps) => {
  return (
    <FooterWrapper>
      <FooterMark>
        TAILGATE<span>PRO</span>
      </FooterMark>
      <FooterText>
        {text} · © {year} TailgatePro
      </FooterText>
      {/* Plain anchors, not router Links: Footer renders in tests and pages
          without a Router, and Twilio needs these URLs to load standalone. */}
      <FooterLinks aria-label="Legal">
        <FooterLink href="/terms">Terms &amp; Conditions</FooterLink>
        <FooterLink href="/privacy">Privacy Policy</FooterLink>
      </FooterLinks>
    </FooterWrapper>
  );
};

export default Footer;
