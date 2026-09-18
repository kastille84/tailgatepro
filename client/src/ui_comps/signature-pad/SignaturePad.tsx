import { useEffect, useImperativeHandle, useRef } from "react";
import SignaturePadLib from "signature_pad";
import type { Ref } from "react";

import { Button } from "../button";
import { StyledActions, StyledCanvas, StyledCanvasFrame, StyledWrapper } from "./styles";
import { dataUrlToBlob } from "./utils";

export interface SignaturePadHandle {
  clear: () => void;
  isEmpty: () => boolean;
  /** Resolves the captured stroke as a PNG blob -- `apiSignatures.ts`'s
   *  `uploadSignatureBlob` hardcodes `Content-Type: image/png` on the
   *  assumption every signature pad export is a PNG, so this always is one. */
  exportBlob: () => Promise<Blob>;
}

interface SignaturePadProps {
  ref?: Ref<SignaturePadHandle>;
  /** Fires after each stroke ends, so a consumer can enable/disable a "Next"
   *  button once there's something to export. */
  onEnd?: (isEmpty: boolean) => void;
  disabled?: boolean;
  hasError?: boolean;
  "aria-label"?: string;
}

/**
 * A canvas-based signature capture control wrapping the `signature_pad`
 * library (docs/tasks.md Phase 4f). Exposes an imperative handle (`ref`
 * taken as a plain prop -- no `forwardRef`, see ui_comps/form/Input.tsx)
 * rather than a controlled value/onChange pair: a signature isn't "typed"
 * incrementally the way a text input is, so the only thing a consumer needs
 * is the final PNG once a worker is done signing.
 *
 * Purely presentational, per docs/tasks.md Phase 4f's 4f/4g boundary: this
 * component only hands back a Blob via `exportBlob()`. It does not call
 * `storeMediaBlob`/`useUploadSignatureBlob`/the outbox itself -- wiring the
 * exported blob into the offline queue is the 4g wizard's job.
 */
export const SignaturePad = ({
  ref,
  onEnd,
  disabled = false,
  hasError = false,
  "aria-label": ariaLabel = "Signature",
}: SignaturePadProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePadLib | null>(null);
  // Keeps the latest onEnd without re-subscribing the "endStroke" listener
  // (and therefore without recreating the pad, which would erase any
  // in-progress stroke) every time a parent re-renders with a new callback
  // identity.
  const onEndRef = useRef(onEnd);

  useEffect(() => {
    onEndRef.current = onEnd;
  });

  useEffect(() => {
    // StyledCanvas always renders (it isn't conditional), so the ref is
    // already attached by the time this effect runs.
    const canvas = canvasRef.current!;

    // Without an explicit backgroundColor, signature_pad defaults to a fully
    // transparent fill -- exported PNGs then show black wherever the
    // viewing surface behind them is dark, making a black penColor stroke
    // unreadable. Force opaque white so the exported PNG always reads as
    // ink on paper, independent of the app's theme.
    const pad = new SignaturePadLib(canvas, { backgroundColor: "#fff" });
    padRef.current = pad;

    const handleEndStroke = () => onEndRef.current?.(pad.isEmpty());
    pad.addEventListener("endStroke", handleEndStroke);

    // Handles both high-DPI screens and the canvas clearing itself whenever
    // its width/height attributes change -- see signature_pad's README
    // "Handling high DPI screens" / "Handling canvas resize" recipes.
    const resizeCanvas = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      // jsdom (used in tests) has no real 2D canvas context and returns
      // null here -- guarded rather than assumed.
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(ratio, ratio);
      pad.clear(); // otherwise isEmpty() can report incorrectly after a resize
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      pad.removeEventListener("endStroke", handleEndStroke);
      pad.off();
      padRef.current = null;
    };
  }, []);

  useEffect(() => {
    // Declared after the mount effect above, so padRef.current is already
    // set by the time this runs, including on the very first render.
    if (disabled) padRef.current!.off();
    else padRef.current!.on();
  }, [disabled]);

  useImperativeHandle(
    ref,
    () => ({
      clear: () => padRef.current!.clear(),
      isEmpty: () => padRef.current!.isEmpty(),
      exportBlob: async () => dataUrlToBlob(padRef.current!.toDataURL("image/png")),
    }),
    [],
  );

  const handleClear = () => {
    padRef.current!.clear();
    onEndRef.current?.(true);
  };

  return (
    <StyledWrapper>
      <StyledCanvasFrame $hasError={hasError} $disabled={disabled}>
        <StyledCanvas
          ref={canvasRef}
          role="img"
          aria-label={ariaLabel}
          aria-invalid={hasError || undefined}
        />
      </StyledCanvasFrame>
      <StyledActions>
        <Button type="button" variant="outline" size="sm" onClick={handleClear} disabled={disabled}>
          Clear
        </Button>
      </StyledActions>
    </StyledWrapper>
  );
};
