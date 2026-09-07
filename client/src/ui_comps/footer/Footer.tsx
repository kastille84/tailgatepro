import { FooterMark, FooterText, FooterWrapper } from "./styles";

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
    </FooterWrapper>
  );
};

export default Footer;
