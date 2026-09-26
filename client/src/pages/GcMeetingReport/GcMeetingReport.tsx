import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";

import { useGcMeetingPdfUrl } from "../../hooks/useGcMeetingPdfUrl";
import { Button } from "../../ui_comps/button";
import { Footer } from "../../ui_comps/footer";
import {
  StyledContainer,
  StyledLede,
  StyledPage,
  StyledSection,
  StyledTitle,
} from "./GcMeetingReport.styles";

/** Landing page for the "link expired?" fallback in the meeting-report email.
 *  Sits behind `RequireAuth` + `RequireGc`, mints a fresh signed PDF URL via
 *  `useGcMeetingPdfUrl`, and offers a button in case the browser blocked the
 *  automatic new-tab open (it isn't a user gesture). */
export const GcMeetingReport = () => {
  const { id } = useParams<{ id: string }>();
  const { openPdf, isPending } = useGcMeetingPdfUrl();
  const requested = useRef(false);

  useEffect(() => {
    if (id && !requested.current) {
      requested.current = true;
      openPdf(id);
    }
  }, [id, openPdf]);

  return (
    <StyledPage>
      <StyledSection>
        <StyledContainer>
          <StyledTitle>Toolbox talk report</StyledTitle>
          <StyledLede role="status" aria-live="polite">
            {isPending
              ? "Opening the report…"
              : "If the report didn't open, tap the button below."}
          </StyledLede>
          <Button
            type="button"
            variant="primary"
            size="md"
            loading={isPending}
            disabled={!id}
            onClick={() => openPdf(id!)}
          >
            Open report
          </Button>
        </StyledContainer>
      </StyledSection>
      <Footer />
    </StyledPage>
  );
};
