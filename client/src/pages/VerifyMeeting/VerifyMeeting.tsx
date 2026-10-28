import type { ChangeEvent } from "react";
import { useParams } from "react-router-dom";
import {
  HiArrowUpTray,
  HiCheckCircle,
  HiExclamationTriangle,
} from "react-icons/hi2";

import { usePublicSealStatus } from "../../hooks/usePublicSealStatus";
import { useVerifyPdfFile } from "../../hooks/useVerifyPdfFile";
import { Footer } from "../../ui_comps/footer";
import { Spinner } from "../../ui_comps/spinner";
import type { PdfFileCheck } from "../../interfaces/meetingLog";
import {
  StyledCard,
  StyledCardTitle,
  StyledContainer,
  StyledDetail,
  StyledDropLabel,
  StyledFileInput,
  StyledLede,
  StyledPage,
  StyledSection,
  StyledTitle,
  StyledVerdict,
} from "./VerifyMeeting.styles";

const FILE_VERDICTS: Record<
  PdfFileCheck["status"],
  { tone: "good" | "bad" | "neutral"; headline: string; detail: string }
> = {
  current: {
    tone: "good",
    headline: "This file is the original report.",
    detail:
      "It is byte-for-byte identical to the report TailgatePro generated for this meeting. Nothing in it has been edited.",
  },
  superseded: {
    tone: "neutral",
    headline: "This is an earlier copy of the report.",
    detail:
      "It matches a version TailgatePro generated for this meeting, but the report has since been regenerated. Ask for the latest copy.",
  },
  "no-match": {
    tone: "bad",
    headline: "This file does not match.",
    detail:
      "It is not a report TailgatePro generated for this meeting. It may have been edited after it was created.",
  },
  "record-altered": {
    tone: "bad",
    headline: "The stored fingerprint failed its integrity check.",
    detail:
      "The fingerprint recorded for this report no longer matches its seal, so the file cannot be trusted. Contact the sender.",
  },
};

/** Public page behind the QR code printed on every report
 *  (docs/tamper-evidence-design.md "PDF seal"). No account needed: it shows
 *  whether the meeting's records are still what was sealed, and lets the
 *  reader drop a PDF to check it hasn't been edited. The file is hashed in the
 *  browser; only the digest is sent. */
export const VerifyMeeting = () => {
  const { id } = useParams<{ id: string }>();
  const { status, isLoading, error } = usePublicSealStatus(id);
  const { checkFile, result, error: fileError, isPending } = useVerifyPdfFile(id);

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Clear the input so choosing the same file again re-runs the check.
    event.target.value = "";
    if (file) checkFile(file);
  };

  const fileVerdict = result ? FILE_VERDICTS[result.status] : undefined;

  return (
    <StyledPage>
      <StyledSection>
        <StyledContainer>
          <StyledTitle>Verify a safety meeting report</StyledTitle>
          <StyledLede>
            Check that a TailgatePro report and the records behind it are
            exactly what was sealed when the meeting was completed.
          </StyledLede>

          <StyledCard aria-labelledby="records-heading">
            <StyledCardTitle id="records-heading">Meeting records</StyledCardTitle>
            {isLoading && <Spinner center label="Checking the records…" />}
            {error && (
              <StyledVerdict $tone="bad" role="alert">
                <HiExclamationTriangle aria-hidden="true" />
                {error.message}
              </StyledVerdict>
            )}
            {status && (
              <>
                <StyledVerdict
                  $tone={status.valid ? "good" : "bad"}
                  role="status"
                >
                  {status.valid ? (
                    <HiCheckCircle aria-hidden="true" />
                  ) : (
                    <HiExclamationTriangle aria-hidden="true" />
                  )}
                  {status.valid
                    ? "Records match what was sealed."
                    : "Records no longer match what was sealed."}
                </StyledVerdict>
                {status.imageMismatchCount > 0 && (
                  <StyledDetail>
                    {status.imageMismatchCount === 1
                      ? "1 image in this report has been replaced since it was created."
                      : `${status.imageMismatchCount} images in this report have been replaced since it was created.`}
                  </StyledDetail>
                )}
              </>
            )}
          </StyledCard>

          {status && (
            <StyledCard aria-labelledby="file-heading">
              <StyledCardTitle id="file-heading">Check a PDF file</StyledCardTitle>
              {status.fileFingerprint ? (
                <>
                  <StyledDetail>
                    Choose the PDF you were sent. It is checked on your device;
                    the file itself is never uploaded.
                  </StyledDetail>
                  <StyledDropLabel>
                    <HiArrowUpTray aria-hidden="true" />
                    {isPending ? "Checking…" : "Tap to choose the PDF"}
                    <StyledFileInput
                      type="file"
                      accept="application/pdf,.pdf"
                      disabled={isPending}
                      onChange={handleFile}
                    />
                  </StyledDropLabel>
                  {fileError && (
                    <StyledVerdict $tone="bad" role="alert">
                      <HiExclamationTriangle aria-hidden="true" />
                      {fileError.message}
                    </StyledVerdict>
                  )}
                  {fileVerdict && (
                    <>
                      <StyledVerdict $tone={fileVerdict.tone} role="status">
                        {fileVerdict.tone === "bad" ? (
                          <HiExclamationTriangle aria-hidden="true" />
                        ) : (
                          <HiCheckCircle aria-hidden="true" />
                        )}
                        {fileVerdict.headline}
                      </StyledVerdict>
                      <StyledDetail>{fileVerdict.detail}</StyledDetail>
                    </>
                  )}
                </>
              ) : (
                <StyledDetail>
                  This report was sealed before file checking was available, so
                  only the records above can be verified.
                </StyledDetail>
              )}
            </StyledCard>
          )}
        </StyledContainer>
      </StyledSection>
      <Footer />
    </StyledPage>
  );
};
