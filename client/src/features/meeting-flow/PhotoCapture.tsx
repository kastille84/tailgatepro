import { useCallback, useEffect, useId, useRef, useState } from "react";
import { HiArrowRight } from "react-icons/hi2";

import { Button } from "../../ui_comps/button";
import { dataUrlToBlob } from "../../ui_comps/signature-pad";
import {
  StyledCameraCanvas,
  StyledComplianceNotice,
  StyledFileInput,
  StyledFileInputLabel,
  StyledPhotoActions,
  StyledPhotoWrapper,
  StyledPreviewFrame,
  StyledPreviewImage,
  StyledVideo,
} from "./styles";

interface PhotoCaptureProps {
  /** Fires with the captured file once a worker snaps or picks a photo. */
  onCapture: (file: File) => void;
  /** Fires when a worker declines to add a crew photo -- optional per
   *  PRD §4.3, so the wizard must be able to move on without one. */
  onSkip: () => void;
}

type Mode =
  | { kind: "idle" }
  | { kind: "camera" }
  | { kind: "captured"; previewUrl: string; file: File }
  | { kind: "fallback" };

const CAMERA_UNAVAILABLE_NOTE = "Camera unavailable -- choose a photo instead.";

const hasCameraSupport = () =>
  typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

/**
 * Crew-photo capture step (docs/tasks.md Phase 4f, PRD §4.3). Opens a live
 * in-browser camera (getUserMedia + a <video> preview + a <canvas> snapshot)
 * consistently on phone, tablet, and desktop -- unlike the old
 * `<input capture="environment">` trick, which only launched a camera on
 * mobile because `capture` is a browser hint desktop/tablet browsers are
 * free to ignore. Falls back to a plain file picker only when a camera
 * genuinely isn't available (unsupported browser, insecure context,
 * permission denied, no camera device). Purely presentational, same 4f/4g
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
  const [mode, setMode] = useState<Mode>(() =>
    hasCameraSupport() ? { kind: "idle" } : { kind: "fallback" },
  );
  const [videoReady, setVideoReady] = useState(false);
  const [cameraNote, setCameraNote] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  // Releases the camera if the step unmounts (e.g. the worker navigates
  // away) while a stream is still live.
  useEffect(() => stopStream, [stopStream]);

  // Revokes the previous preview's object URL whenever it's replaced/torn
  // down, so a worker retaking the photo several times doesn't leak blobs.
  useEffect(() => {
    if (mode.kind !== "captured") return;
    return () => URL.revokeObjectURL(mode.previewUrl);
  }, [mode]);

  // Binds the live stream once camera mode has actually rendered the
  // <video> element -- the ref is already attached by the time this effect
  // runs, since it fires after the render that switched into "camera" mode.
  useEffect(() => {
    if (mode.kind !== "camera") return;
    const video = videoRef.current;
    if (video) video.srcObject = streamRef.current;
  }, [mode]);

  const openCamera = async () => {
    setVideoReady(false);
    setCameraNote(null);

    if (!hasCameraSupport()) {
      setMode({ kind: "fallback" });
      return;
    }

    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      setMode({ kind: "camera" });
    } catch {
      // Permission denied, no camera device, device busy, or an insecure
      // context -- fall back to the file picker rather than getting stuck.
      setCameraNote(CAMERA_UNAVAILABLE_NOTE);
      setMode({ kind: "fallback" });
    }
  };

  const handleVideoReady = () => setVideoReady(true);

  const handleCapture = () => {
    // Capture only renders while mode is "camera", so both refs are already
    // attached by the time this can fire -- same non-null-assertion pattern
    // as SignaturePad.tsx's imperative handle.
    const video = videoRef.current!;
    const canvas = canvasRef.current!;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      // No 2D context available on this device/browser -- can't snapshot.
      stopStream();
      setCameraNote(CAMERA_UNAVAILABLE_NOTE);
      setMode({ kind: "fallback" });
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    stopStream();

    const blob = dataUrlToBlob(canvas.toDataURL("image/jpeg", 0.92));
    const file = new File([blob], "crew-photo.jpg", { type: "image/jpeg" });

    setMode({ kind: "captured", previewUrl: URL.createObjectURL(blob), file });
  };

  const handleCancelCamera = () => {
    stopStream();
    setMode({ kind: "idle" });
  };

  const handleRetake = () => {
    void openCamera();
  };

  const handleConfirm = () => {
    if (mode.kind !== "captured") return;
    onCapture(mode.file);
  };

  const handleSkip = () => {
    stopStream();
    onSkip();
  };

  const handleFallbackChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setMode({ kind: "captured", previewUrl: URL.createObjectURL(file), file });
    // Clears the input's own value so choosing the same file again still
    // fires a change event.
    event.target.value = "";
  };

  return (
    <StyledPhotoWrapper>
      <StyledComplianceNotice>
        This photo is for attendance / proof-of-training only. It is not
        analyzed or matched against any facial-recognition or biometric
        database. Adding a photo is optional.
      </StyledComplianceNotice>

      {mode.kind === "idle" && (
        <StyledPhotoActions>
          <Button type="button" size="lg" onClick={handleRetake}>
            Take crew photo
          </Button>
        </StyledPhotoActions>
      )}

      {mode.kind === "camera" && (
        <>
          <StyledPreviewFrame>
            <StyledVideo
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={handleVideoReady}
            />
          </StyledPreviewFrame>
          <StyledCameraCanvas ref={canvasRef} aria-hidden="true" />
          <StyledPhotoActions>
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={handleCancelCamera}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="lg"
              onClick={handleCapture}
              disabled={!videoReady}
            >
              Capture
            </Button>
          </StyledPhotoActions>
        </>
      )}

      {mode.kind === "captured" && (
        <>
          <StyledPreviewFrame>
            <StyledPreviewImage src={mode.previewUrl} alt="Captured crew photo" />
          </StyledPreviewFrame>
          <StyledPhotoActions>
            <Button type="button" variant="outline" size="md" onClick={handleRetake}>
              Retake photo
            </Button>
            <Button
              type="button"
              size="md"
              onClick={handleConfirm}
              rightIcon={<HiArrowRight aria-hidden="true" />}
            >
              Use photo
            </Button>
          </StyledPhotoActions>
        </>
      )}

      {mode.kind === "fallback" && (
        <>
          {cameraNote && <StyledComplianceNotice>{cameraNote}</StyledComplianceNotice>}
          <StyledFileInputLabel htmlFor={inputId}>Choose a photo</StyledFileInputLabel>
          <StyledFileInput
            id={inputId}
            type="file"
            accept="image/*"
            onChange={handleFallbackChange}
          />
        </>
      )}

      <StyledPhotoActions>
        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={handleSkip}
          rightIcon={<HiArrowRight aria-hidden="true" />}
        >
          Skip photo
        </Button>
      </StyledPhotoActions>
    </StyledPhotoWrapper>
  );
};
