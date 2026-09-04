import {
  StyledPdfCard,
  StyledPdfHeader,
  StyledPdfMark,
  StyledPdfKicker,
  StyledPdfMeta,
  StyledPdfSignatures,
  StyledPdfSignatureRow,
  StyledPdfSeal,
  StyledPdfWatermark,
} from "./CompliancePdfCard.styles";

interface CompliancePdfCardProps {
  topic?: string;
  date?: string;
  crew?: string[];
}

const DEFAULT_CREW = ["M. Rivera", "D. Okafor", "J. Chen", "P. Nowak"];

/** A stylised sample of the compliance PDF a GC receives after a talk. */
export const CompliancePdfCard = ({
  topic = "Fall Protection",
  date = "May 14, 2025",
  crew = DEFAULT_CREW,
}: CompliancePdfCardProps) => {
  const label = `Example TailgatePro compliance PDF — a signed ${topic} toolbox talk with ${crew.length} crew signatures and a GPS-verified seal.`;

  return (
    <StyledPdfCard role="img" aria-label={label}>
      <div aria-hidden="true">
        <StyledPdfHeader>
          <StyledPdfMark>
            TAILGATE<span>PRO</span>
          </StyledPdfMark>
          <StyledPdfKicker>Toolbox Talk Record</StyledPdfKicker>
        </StyledPdfHeader>
      </div>

      <StyledPdfMeta aria-hidden="true">
        <dt>Topic</dt>
        <dd>{topic}</dd>
        <dt>Date</dt>
        <dd>{date}</dd>
        <dt>Site</dt>
        <dd>Downtown Tower</dd>
        <dt>Foreman</dt>
        <dd>M. Rivera</dd>
      </StyledPdfMeta>

      <StyledPdfSignatures aria-hidden="true">
        {crew.map((name) => (
          <StyledPdfSignatureRow key={name}>
            <span>{name}</span>
            <svg
              width="76"
              height="14"
              viewBox="0 0 76 14"
              fill="none"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M2 9 q6 -10 12 -1 t12 -1 q5 -8 10 0 t12 1 q6 -9 12 -2 t12 2"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </StyledPdfSignatureRow>
        ))}
      </StyledPdfSignatures>

      <StyledPdfSeal aria-hidden="true">GPS-Verified</StyledPdfSeal>

      <StyledPdfWatermark aria-hidden="true">
        Logged via TailgatePro
      </StyledPdfWatermark>
    </StyledPdfCard>
  );
};
