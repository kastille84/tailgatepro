import { useEffect, useRef } from "react";
import toast from "react-hot-toast";
import QRCode from "qrcode";

import { Button } from "../../ui_comps/button";
import { Spinner } from "../../ui_comps/spinner";
import { useCrewJoinLink } from "../../hooks/useCrewJoinLink";
import type { InHouseCrew } from "../../interfaces/inHouseCrew";
import { triggerBrowserDownload } from "../../utils/triggerBrowserDownload";
import {
  StyledJoinQrActions,
  StyledJoinQrCanvasFrame,
  StyledJoinQrUrl,
  StyledJoinQrWrap,
} from "../jobsites/styles";
import { StyledNote, StyledSection, StyledSectionTitle } from "./styles";

/** A filename-safe slug: lowercase, non-alphanumerics collapsed to one hyphen. */
const slugifyForFilename = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "crew";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

interface CrewJoinLinkSectionProps {
  crew: InHouseCrew;
}

/** A crew's open join link and QR (Phase 13f-join). Anyone who opens it can sign
 *  up as a foreman of this crew until it expires or the spots run out, so the
 *  copy says so plainly. Rendered client-side, so the link never goes to a
 *  third-party QR service. An archived crew cannot take new people. */
export const CrewJoinLinkSection = ({ crew }: CrewJoinLinkSectionProps) => {
  const { link, isLoading, isError, createLink, isCreating, turnOff, isTurningOff } =
    useCrewJoinLink(crew.archivedAt ? undefined : crew.id);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const joinUrl = link?.joinUrl;

  useEffect(() => {
    if (!joinUrl || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, joinUrl, { width: 180, margin: 1 }).catch(() => {
      toast.error("Could not render the QR code.");
    });
  }, [joinUrl]);

  const handleCreate = async () => {
    try {
      await createLink();
    } catch {
      // useCrewJoinLink already surfaces the failure as a toast.
    }
  };

  const handleTurnOff = async () => {
    try {
      await turnOff();
    } catch {
      // useCrewJoinLink already surfaces the failure as a toast.
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl!);
      toast.success("Join link copied");
    } catch {
      // Clipboard access can be denied or unavailable; the link is still shown.
      toast.error("Could not copy. Select the link and copy it manually.");
    }
  };

  const handleDownload = () => {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) {
        toast.error("Could not download the QR code.");
        return;
      }
      triggerBrowserDownload(blob, `${slugifyForFilename(crew.name)}-join-qr.png`);
    });
  };

  return (
    <StyledSection aria-labelledby="crew-join-link-title">
      <StyledSectionTitle id="crew-join-link-title">Join link</StyledSectionTitle>

      {crew.archivedAt && <StyledNote>Restore this crew to make a join link.</StyledNote>}
      {isLoading && <Spinner message="Loading the join link…" />}
      {isError && <StyledNote role="alert">Could not load the join link. Close and try again.</StyledNote>}

      {!crew.archivedAt && !isLoading && !isError && !link && (
        <>
          <StyledNote>
            Make a link or QR code your foremen can open to join {crew.name} without you knowing
            their email first. Anyone with it can join as a foreman until it expires or the spots
            run out.
          </StyledNote>
          <div>
            <Button type="button" variant="primary" size="md" loading={isCreating} onClick={handleCreate}>
              Create join link
            </Button>
          </div>
        </>
      )}

      {link && (
        <StyledJoinQrWrap>
          <StyledJoinQrCanvasFrame>
            <canvas
              ref={canvasRef}
              role="img"
              aria-label={`QR code linking to join ${crew.name}`}
            />
          </StyledJoinQrCanvasFrame>
          <StyledJoinQrUrl aria-label="Crew join link">{link.joinUrl}</StyledJoinQrUrl>
          <StyledNote>
            Expires {formatDate(link.expiresAt)}. {link.usesLeft}{" "}
            {link.usesLeft === 1 ? "spot" : "spots"} left. Anyone with this link can join{" "}
            {crew.name} as a foreman.
          </StyledNote>
          <StyledJoinQrActions>
            <Button type="button" size="sm" variant="outline" onClick={handleCopy}>
              Copy link
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={handleDownload}>
              Download QR
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              loading={isCreating}
              onClick={handleCreate}
            >
              Make a new link
            </Button>
            <Button
              type="button"
              size="sm"
              variant="danger"
              loading={isTurningOff}
              onClick={handleTurnOff}
            >
              Turn off
            </Button>
          </StyledJoinQrActions>
          <StyledNote>Making a new link stops the old one from working.</StyledNote>
        </StyledJoinQrWrap>
      )}
    </StyledSection>
  );
};
