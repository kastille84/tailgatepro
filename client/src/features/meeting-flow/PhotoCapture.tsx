import { useEffect, useId, useState } from "react";

import { Button } from "../../ui_comps/button";
import {
  StyledComplianceNotice,
  StyledFileInput,
  StyledFileInputLabel,
  StyledPhotoActions,
  StyledPhotoWrapper,
  StyledPreviewFrame,
  StyledPreviewImage,
} from "./styles";

interface PhotoCaptureProps {
  /** Fires with the captured file once a worker picks/takes a photo. */
  onCapture: (file: File) => void;
  /** Fires when a worker declines to add a crew photo -- optional per
   *  PRD §4.3, so the wizard must be able to move on without one. */
  onSkip: () => void;
}

/**
 * Crew-photo capture step (docs/tasks.md Phase 4f, PRD §4.3). No image
 * library -- a plain `<input type="file" accept="image/*"
 * capture="environment">` opens the device camera directly on mobile and
 * falls back to a file picker on desktop. Purely presentational, same 4f/4g
 * boundary as `SignaturePad`/`Quiz`: this component only hands back the
 * chosen `File` via `onCapture` and does not touch `mediaBlobs`/the outbox
 * itself.
 *
 * The compliance notice is always visible, not just on error/hover --
 * PRD §4.3's BIPA-adjacent requirement is that the UX "clearly communicates"
 * the photo is for attendance proof only, never biometric/facial-recognition
 * analysis, and that capturing one is optional.
 */
export const PhotoCapture = ({ onCapture, onSkip }: PhotoCaptureProps) => {
  const inputId = useId();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Revokes the previous preview's object URL whenever it's replaced/torn
  // down, so a worker retaking the photo several times doesn't leak blobs.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
    onCapture(file);
    // Clears the input's own value so choosing the same file again (e.g. a
    // retake that reuses the last shot) still fires a change event.
    event.target.value = "";
  };

  return (
    <StyledPhotoWrapper>
      <StyledComplianceNotice>
        This photo is for attendance / proof-of-training only. It is not
        analyzed or matched against any facial-recognition or biometric
        database. Adding a photo is optional.
      </StyledComplianceNotice>

      {previewUrl && (
        <StyledPreviewFrame>
          <StyledPreviewImage src={previewUrl} alt="Captured crew photo" />
        </StyledPreviewFrame>
      )}

      <StyledFileInputLabel htmlFor={inputId}>
        {previewUrl ? "Retake photo" : "Take crew photo"}
      </StyledFileInputLabel>
      <StyledFileInput
        id={inputId}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
      />

      <StyledPhotoActions>
        <Button type="button" variant="outline" size="md" onClick={onSkip}>
          Skip photo
        </Button>
      </StyledPhotoActions>
    </StyledPhotoWrapper>
  );
};
