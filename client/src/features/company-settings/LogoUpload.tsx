import { useEffect, useId, useState } from "react";

import { Button } from "../../ui_comps/button";
import {
  StyledFileInput,
  StyledFileInputLabel,
  StyledLogoActions,
  StyledLogoPreviewEmpty,
  StyledLogoPreviewFrame,
  StyledLogoPreviewImage,
} from "./styles";

interface LogoUploadProps {
  /** A signed URL for the currently-saved logo, or `null` if none exists yet. */
  currentLogoUrl: string | null;
  isUploading: boolean;
  /** Fires once the worker confirms a newly chosen file. Presentational only
   *  — mirrors `PhotoCapture`'s onCapture boundary — the caller owns the
   *  actual upload mutation. */
  onUpload: (file: File) => Promise<unknown>;
}

/**
 * Company logo upload control for the Settings page (Phase 5e follow-up:
 * tier-gated PDF branding). Modeled on `features/meeting-flow/PhotoCapture`'s
 * fallback file-input pattern, simplified — always a plain file picker, no
 * camera branch. A newly chosen file previews locally and requires an
 * explicit "Save logo" confirmation before the upload fires, same
 * select-then-confirm shape as `PhotoCapture`'s "captured" mode.
 */
export const LogoUpload = ({
  currentLogoUrl,
  isUploading,
  onUpload,
}: LogoUploadProps) => {
  const inputId = useId();
  const [pending, setPending] = useState<{ file: File; previewUrl: string } | null>(
    null,
  );

  // Revokes the pending preview's object URL whenever it's replaced or the
  // component unmounts, so re-picking a file several times doesn't leak blobs.
  useEffect(() => {
    if (!pending) return;
    return () => URL.revokeObjectURL(pending.previewUrl);
  }, [pending]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setPending({ file, previewUrl: URL.createObjectURL(file) });
    // Clears the input's own value so choosing the same file again still
    // fires a change event.
    event.target.value = "";
  };

  const handleCancel = () => setPending(null);

  const handleSave = async () => {
    // The Save button only renders inside the `pending` branch below, so
    // this is always reached with a selection already set (matching the
    // non-null-assertion precedent in ProjectForm.tsx/TalkForm.tsx's own
    // delete handlers, rather than an untestable dead-code guard).
    const { file } = pending!;
    try {
      await onUpload(file);
      setPending(null);
    } catch {
      // The upload hook already surfaces the error via a toast — the
      // pending preview stays so the worker can retry without re-picking.
    }
  };

  const previewUrl = pending?.previewUrl ?? currentLogoUrl;

  return (
    <>
      <StyledLogoPreviewFrame>
        {previewUrl ? (
          <StyledLogoPreviewImage src={previewUrl} alt="Company logo" />
        ) : (
          <StyledLogoPreviewEmpty>No logo uploaded yet</StyledLogoPreviewEmpty>
        )}
      </StyledLogoPreviewFrame>

      {pending ? (
        <StyledLogoActions>
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={handleCancel}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="md"
            onClick={handleSave}
            loading={isUploading}
          >
            Save logo
          </Button>
        </StyledLogoActions>
      ) : (
        <StyledLogoActions>
          <StyledFileInputLabel htmlFor={inputId}>
            {currentLogoUrl ? "Change logo" : "Upload logo"}
          </StyledFileInputLabel>
          <StyledFileInput
            id={inputId}
            type="file"
            accept="image/*"
            onChange={handleChange}
          />
        </StyledLogoActions>
      )}
    </>
  );
};
