import { useEffect, useRef } from "react";
import toast from "react-hot-toast";
import QRCode from "qrcode";

import { Button } from "../../ui_comps/button";
import { Spinner } from "../../ui_comps/spinner";
import { triggerBrowserDownload } from "../../utils/triggerBrowserDownload";
import {
  StyledJoinQrActions,
  StyledJoinQrCanvasFrame,
  StyledJoinQrUrl,
  StyledJoinQrWrap,
} from "./styles";
import { useJobsiteJoinLink } from "../../hooks/useJobsiteJoinLink";

/** A filename-safe slug — lowercase, non-alphanumerics collapsed to a single
 *  hyphen, leading/trailing hyphens trimmed. Local to this one download, not
 *  worth a shared util for a single caller. */
const slugifyForFilename = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "job-site";

interface JobsiteJoinQrCardProps {
  jobsiteId: string;
  jobsiteName: string;
}

/**
 * A jobsite's standing QR/join link (Phase 9e, `docs/jobsite-qr-join-design.md`):
 * any subcontractor who scans it self-admits their company onto this jobsite
 * immediately — no GC approval. The roster above (and its "Remove" button)
 * is the control, not a gate before joining, per the product decision behind
 * this feature. Rendered entirely client-side, so the join link is never sent
 * to a third-party QR image service.
 */
export const JobsiteJoinQrCard = ({
  jobsiteId,
  jobsiteName,
}: JobsiteJoinQrCardProps) => {
  const { joinUrl, isLoading, isError } = useJobsiteJoinLink(jobsiteId);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!joinUrl || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, joinUrl, { width: 180, margin: 1 }).catch(() => {
      toast.error("Could not render the QR code.");
    });
  }, [joinUrl]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl!);
      toast.success("Join link copied");
    } catch {
      // Clipboard access can be denied or unavailable (insecure context,
      // permissions) — the link is still shown on screen to copy manually.
      toast.error("Could not copy. Select the link and copy it manually.");
    }
  };

  const handleDownload = () => {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) {
        toast.error("Could not download the QR code.");
        return;
      }
      triggerBrowserDownload(blob, `${slugifyForFilename(jobsiteName)}-join-qr.png`);
    });
  };

  return (
    <StyledJoinQrWrap>
      {isLoading && <Spinner message="Loading this job site's QR code…" />}
      {isError && (
        <p role="alert">Could not load the QR code. Refresh to try again.</p>
      )}
      {joinUrl && (
        <>
          <StyledJoinQrCanvasFrame>
            <canvas
              ref={canvasRef}
              role="img"
              aria-label={`QR code linking to join ${jobsiteName}`}
            />
          </StyledJoinQrCanvasFrame>
          <StyledJoinQrUrl aria-label="Job site join link">{joinUrl}</StyledJoinQrUrl>
          <StyledJoinQrActions>
            <Button type="button" size="sm" variant="outline" onClick={handleCopy}>
              Copy link
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={handleDownload}>
              Download QR
            </Button>
          </StyledJoinQrActions>
        </>
      )}
    </StyledJoinQrWrap>
  );
};
